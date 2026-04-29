import { Controller, Post, Headers, ForbiddenException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const TENANT = '00000000-0000-0000-0000-000000000001';
const MIN_SCORE = 70;

function cleanName(name: string): string {
  let n = name.toLowerCase().trim();
  for (const p of ['tab ', 'cap ', 'syp ', 'syr ', 'inj ', 'oint ', 'crm ', 'eye-dps ', 'dps ']) {
    if (n.startsWith(p)) n = n.slice(p.length);
  }
  return n.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokenSortRatio(a: string, b: string): number {
  const sa = a.split(' ').sort().join(' ');
  const sb = b.split(' ').sort().join(' ');
  if (sa === sb) return 100;
  const longer = Math.max(sa.length, sb.length);
  if (longer === 0) return 100;
  let matches = 0;
  const bChars = sb.split('');
  for (const c of sa) {
    const idx = bChars.indexOf(c);
    if (idx >= 0) { matches++; bChars.splice(idx, 1); }
  }
  return Math.round((2 * matches / (sa.length + sb.length)) * 100);
}

const CLASS_MAP: Record<string, string> = {
  'ANTI INFECTIVES': 'Antibiotics', 'GASTRO INTESTINAL': 'Gastro',
  'PAIN ANALGESICS': 'Fever & Pain', 'NEURO CNS': 'Neurology / Psychiatry',
  'RESPIRATORY': 'Respiratory', 'CARDIAC': 'BP / Cardiac',
  'ANTI DIABETIC': 'Diabetes', 'OPHTHAL': 'Eye / Ear / ENT',
  'DERMA': 'Skin / Dermatology', 'HORMONES': 'Hormones',
  'GYNAECOLOGICAL': 'Hormones', 'VITAMINS MINERALS NUTRIENTS': 'Vitamins & Supplements',
  'BLOOD RELATED': 'BP / Cardiac', 'UROLOGY': 'Urology',
  'OPHTHAL OTOLOGICALS': 'Eye / Ear / ENT', 'ANTI MALARIALS': 'Antibiotics',
  'OTOLOGICALS': 'Eye / Ear / ENT', 'OTHERS': 'Other',
};

@Controller('admin')
export class KaggleImportController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('kaggle-import')
  @UseInterceptors(FileInterceptor('file'))
  async importKaggle(
    @Headers('x-admin-key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (key !== 'medisyn-import-2024') throw new ForbiddenException();

    // Parse CSV
    const text = file.buffer.toString('utf-8');
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));

    const rows = lines.slice(1).filter(l => l.trim()).map(line => {
      const vals: string[] = [];
      let cur = '', inQ = false;
      for (const c of line) {
        if (c === '"') { inQ = !inQ; }
        else if (c === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
        else cur += c;
      }
      vals.push(cur.trim());
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
      return obj;
    });

    // Get our medicines
    const medicines = await this.ds.query(
      `SELECT id, brand_name FROM medicines WHERE tenant_id = $1`, [TENANT]
    );

    const kaggleClean = rows.map(r => cleanName(r.name || ''));
    let matched = 0, saved = 0;

    for (const med of medicines) {
      const medClean = cleanName(med.brand_name);
      let bestScore = 0, bestIdx = -1;

      for (let i = 0; i < kaggleClean.length; i++) {
        const score = tokenSortRatio(medClean, kaggleClean[i]);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }

      if (bestScore < MIN_SCORE || bestIdx === -1) continue;
      matched++;

      const row = rows[bestIdx];
      const therapeutic = (row['Therapeutic Class'] || '').trim();
      const category    = CLASS_MAP[therapeutic] || null;
      const habit       = (row['Habit Forming'] || '').trim().toLowerCase();
      const schedule    = habit === 'yes' ? 'X' :
                          ['ANTI INFECTIVES','CARDIAC','ANTI DIABETIC','HORMONES','NEURO CNS'].some(c => therapeutic.includes(c)) ? 'H' : null;
      const use         = (row['use0'] || '').trim() || null;
      const chem        = (row['Chemical Class'] || '').trim() || null;
      const subs        = [0,1,2,3,4].map(i => (row[`substitute${i}`] || '').trim()).filter(Boolean);
      const effects     = [0,1,2,3,4].map(i => (row[`sideEffect${i}`] || '').trim()).filter(Boolean);

      await this.ds.query(`
        INSERT INTO molecule_suggestions (
          medicine_id, tenant_id, matched_name, match_score,
          suggested_category, suggested_use, suggested_schedule,
          suggested_subs, chemical_class, side_effects,
          status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW(),NOW())
        ON CONFLICT (medicine_id, tenant_id) DO UPDATE SET
          matched_name=EXCLUDED.matched_name, match_score=EXCLUDED.match_score,
          suggested_category=EXCLUDED.suggested_category, suggested_use=EXCLUDED.suggested_use,
          suggested_schedule=EXCLUDED.suggested_schedule, suggested_subs=EXCLUDED.suggested_subs,
          chemical_class=EXCLUDED.chemical_class, side_effects=EXCLUDED.side_effects,
          status='pending', updated_at=NOW()
      `, [med.id, TENANT, row.name, bestScore, category, use, schedule,
          subs, chem, effects]);
      saved++;
    }

    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*) FROM molecule_suggestions WHERE tenant_id=$1 AND status='pending'`, [TENANT]
    );

    return { matched, saved, pending_suggestions: count };
  }
}
