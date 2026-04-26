import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const TENANT = '00000000-0000-0000-0000-000000000001';
const BATCH_SIZE = 20;
const VALID_FORMS = [
  'Tablet','Capsule','Syrup','Injection','Vial','Suspension',
  'Drops','Powder','Gel','Liquid','Lotion','Cream','Eye Drops',
  'Ointment','Soap','Inhaler','Pill','Patch','Paste','Spray',
  'Solution','Sachet','Granules','Other'
];

function makeGroupKey(molecule: string, strength: string, form: string): string | null {
  if (!molecule || molecule.toLowerCase().includes('as per') || molecule.length < 2) return null;
  const mol = molecule.toLowerCase().replace(/[^a-z0-9+]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const str = (strength || '').toLowerCase().replace(/[^a-z0-9%.]/g, '').slice(0, 20);
  const frm = (form || '').toLowerCase().replace(/\s+/g, '_');
  return `${mol}_${str}_${frm}`;
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

@Controller('admin')
export class MoleculeClassifierController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('classify-molecules')
  async classify(@Headers('x-admin-key') key: string) {
    if (key !== 'medisyn-import-2024') throw new ForbiddenException();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { error: 'ANTHROPIC_API_KEY not set' };

    // Use queryRunner for explicit transaction control
    const runner = this.ds.createQueryRunner();
    await runner.connect();

    const medicines = await runner.query(`
      SELECT id, brand_name, molecule, strength, dosage_form
      FROM medicines
      WHERE tenant_id = $1
        AND (molecule = '' OR molecule IS NULL OR molecule_source = 'unset')
      ORDER BY brand_name ASC
    `, [TENANT]);

    let updated = 0, confident = 0, uncertain = 0, errors = 0;

    for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
      const batch = medicines.slice(i, i + BATCH_SIZE);

      const list = batch.map((m: any, idx: number) =>
        `${idx + 1}. "${m.brand_name}"`
      ).join('\n');

      const prompt = `You are an Indian pharmacy drug database expert. For each medicine below, extract the correct details.

Medicines:
${list}

Return a JSON array with exactly ${batch.length} objects:
- "molecule": active ingredient(s), standard INN names, use " + " for combinations
- "strength": concentration e.g. "500mg", "5%", "40mg". Use "As per label" if unknown
- "dosage_form": exactly one of: ${VALID_FORMS.join(', ')}
- "confident": true/false

Rules: TAB=Tablet, CAP=Capsule, SYP=Syrup, INJ=Injection, CREAM/OINT/GEL=correct form.
Return ONLY valid JSON array, no markdown.`;

      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2000,
            messages: [{ role: 'user', content: prompt }],
          }),
        });

        const data = await response.json();
        const text = data.content?.[0]?.text || '[]';
        const clean = text.replace(/```json|```/g, '').trim();
        const results = JSON.parse(clean);

        // Begin transaction for this batch
        await runner.startTransaction();
        try {
          for (let j = 0; j < batch.length; j++) {
            const med = batch[j];
            const result = results[j];
            if (!result) { errors++; continue; }

            const form = VALID_FORMS.includes(result.dosage_form) ? result.dosage_form : 'Other';
            const groupKey = makeGroupKey(result.molecule, result.strength, form);

            await runner.query(`
              UPDATE medicines SET
                molecule             = $1,
                strength             = $2,
                dosage_form          = $3,
                molecule_confidence  = $4,
                molecule_verified    = false,
                molecule_source      = 'claude-haiku-batch',
                substitute_group_key = $5,
                updated_at           = NOW()
              WHERE id = $6
            `, [
              result.molecule || '',
              result.strength || 'As per label',
              form,
              result.confident ? 0.9 : 0.5,
              groupKey,
              med.id,
            ]);

            updated++;
            if (result.confident) confident++; else uncertain++;
          }
          await runner.commitTransaction();
        } catch (e: any) {
          await runner.rollbackTransaction();
          errors += batch.length;
        }
      } catch (e: any) {
        errors += batch.length;
      }

      await sleep(500);
    }

    await runner.release();

    const [{ count: groups }] = await this.ds.query(`
      SELECT COUNT(DISTINCT substitute_group_key) AS count
      FROM medicines WHERE tenant_id = $1 AND substitute_group_key IS NOT NULL
    `, [TENANT]);

    return {
      status: 'success',
      total: medicines.length,
      updated,
      confident,
      uncertain,
      errors,
      substitute_groups: groups,
    };
  }
}
