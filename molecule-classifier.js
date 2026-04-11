#!/usr/bin/env node
/**
 * MediSyn Molecule Classifier
 * Fixes strength, dosage_form, verifies molecule, regenerates substitute_group_key
 * for all medicines with 'As per label' strength.
 *
 * Usage:
 *   node molecule-classifier.js
 *
 * Requires in .env or environment:
 *   DATABASE_URL=postgresql://postgres:PASSWORD@shortline.proxy.rlwy.net:28446/railway
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

const { Client } = require('pg');
const Anthropic = require('@anthropic-ai/sdk');

// ── Config ────────────────────────────────────────────────────────────────────
const TENANT_ID     = '00000000-0000-0000-0000-000000000001';
const BATCH_SIZE    = 20;   // medicines per Claude API call
const DELAY_MS      = 1000; // delay between batches to avoid rate limits
const DRY_RUN       = false; // set true to preview without writing to DB

// Valid dosage forms from your DosageForm enum
const VALID_FORMS = [
  'Tablet','Capsule','Syrup','Injection','Vial','Suspension',
  'Drops','Powder','Gel','Liquid','Lotion','Cream','Eye Drops',
  'Ointment','Soap','Inhaler','Pill','Patch','Paste','Spray',
  'Solution','Sachet','Granules','Other'
];

// ── Init ──────────────────────────────────────────────────────────────────────
require('dotenv').config();

const db = new Client({ connectionString: process.env.DATABASE_URL });
const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeGroupKey(molecule, strength, dosageForm) {
  if (!molecule || molecule.toLowerCase().includes('as per') || molecule.length < 2) return null;
  const mol = molecule.toLowerCase().replace(/[^a-z0-9+]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  const str = (strength || '').toLowerCase().replace(/[^a-z0-9%\.]/g, '').slice(0, 20);
  const frm = (dosageForm || '').toLowerCase().replace(/\s+/g, '_');
  return `${mol}_${str}_${frm}`;
}

// ── Claude classifier ─────────────────────────────────────────────────────────
async function classifyBatch(medicines) {
  const list = medicines.map((m, i) =>
    `${i + 1}. "${m.brand_name}" (current molecule: "${m.molecule}")`
  ).join('\n');

  const prompt = `You are an Indian pharmacy drug database expert. For each medicine below, extract the correct details from the brand name and your knowledge of Indian pharmaceutical products.

Medicines to classify:
${list}

For each medicine return a JSON array with exactly ${medicines.length} objects in the same order.
Each object must have:
- "molecule": the active ingredient(s) — use standard INN names, use " + " to join combinations (e.g. "Amoxicillin + Clavulanic Acid"). If truly unknown use the provided current molecule value.
- "strength": the actual strength/concentration extracted from brand name or known formulation (e.g. "500mg", "5%", "40mg", "0.1%"). If truly unknown use "As per label".
- "dosage_form": must be exactly one of: ${VALID_FORMS.join(', ')}. Infer from brand name suffix (CREAM, GEL, DROPS, SYRUP, INJ, TAB, CAP etc.)
- "confident": true if you are sure about molecule+strength+form, false if uncertain
- "note": brief reason if not confident, else empty string

Rules:
- Creams/ointments/gels/lotions/pastes: NEVER classify as Tablet
- Eye/ear/nasal drops: use "Drops" or "Eye Drops" appropriately  
- INJ/injection suffix: use "Injection"
- TAB/tablet suffix: use "Tablet"
- CAP/capsule suffix: use "Capsule"
- SYP/syrup suffix: use "Syrup"
- Inhaler/rotacap/respules: use "Inhaler"
- If brand name contains a % (like "5%"), that is the strength
- For combination products keep ALL molecules in the molecule field

Return ONLY a valid JSON array, no markdown, no explanation.`;

  try {
    const response = await ai.messages.create({
      model: 'claude-haiku-4-5-20251001',  // Use Haiku — cheaper for bulk
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const results = JSON.parse(clean);

    if (!Array.isArray(results) || results.length !== medicines.length) {
      throw new Error(`Expected ${medicines.length} results, got ${results.length}`);
    }
    return results;
  } catch (err) {
    console.error('  ⚠️  Claude API error:', err.message);
    // Return safe fallback — mark all as unconfident
    return medicines.map(m => ({
      molecule: m.molecule,
      strength: 'As per label',
      dosage_form: 'Other',
      confident: false,
      note: 'API error during classification',
    }));
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  await db.connect();
  console.log('✅ Connected to database\n');

  // Fetch all medicines needing classification
  const { rows: medicines } = await db.query(
    `SELECT id, brand_name, molecule, strength, dosage_form
     FROM medicines
     WHERE tenant_id = $1
       AND (strength = 'As per label' OR molecule_verified = false OR molecule_source = 'unset')
     ORDER BY brand_name ASC`,
    [TENANT_ID]
  );

  console.log(`📦 Found ${medicines.length} medicines to classify\n`);

  if (medicines.length === 0) {
    console.log('Nothing to do — all medicines already classified!');
    await db.end();
    return;
  }

  // Stats
  let updated = 0, confident = 0, uncertain = 0, errors = 0;
  const uncertainList = [];

  // Process in batches
  const totalBatches = Math.ceil(medicines.length / BATCH_SIZE);

  for (let i = 0; i < medicines.length; i += BATCH_SIZE) {
    const batch     = medicines.slice(i, i + BATCH_SIZE);
    const batchNum  = Math.floor(i / BATCH_SIZE) + 1;
    const pct       = Math.round((i / medicines.length) * 100);

    process.stdout.write(`\r⚙️  Batch ${batchNum}/${totalBatches} (${pct}%) — ${updated} updated, ${uncertain} flagged...`);

    const results = await classifyBatch(batch);

    for (let j = 0; j < batch.length; j++) {
      const med    = batch[j];
      const result = results[j];

      if (!result) { errors++; continue; }

      // Validate dosage_form
      const form = VALID_FORMS.includes(result.dosage_form) ? result.dosage_form : 'Other';

      // Generate substitute_group_key
      const groupKey = makeGroupKey(result.molecule, result.strength, form);

      if (!DRY_RUN) {
        try {
          await db.query(
            `UPDATE medicines SET
               molecule             = $1,
               strength             = $2,
               dosage_form          = $3,
               molecule_confidence  = $4,
               molecule_verified    = $5,
               molecule_source      = 'claude-haiku-batch',
               substitute_group_key = $6,
               updated_at           = NOW()
             WHERE id = $7`,
            [
              result.molecule,
              result.strength,
              form,
              result.confident ? 0.9 : 0.5,
              false,  // never auto-mark as human-verified
              groupKey,
              med.id,
            ]
          );
          updated++;
        } catch (err) {
          console.error(`\n  ❌ DB error for ${med.brand_name}:`, err.message);
          errors++;
          continue;
        }
      } else {
        console.log(`\n  [DRY RUN] ${med.brand_name}`);
        console.log(`    molecule:    ${result.molecule}`);
        console.log(`    strength:    ${result.strength}`);
        console.log(`    form:        ${form}`);
        console.log(`    group_key:   ${groupKey}`);
        console.log(`    confident:   ${result.confident}`);
        updated++;
      }

      if (result.confident) {
        confident++;
      } else {
        uncertain++;
        uncertainList.push({
          id:         med.id,
          brand_name: med.brand_name,
          molecule:   result.molecule,
          strength:   result.strength,
          form,
          note:       result.note,
        });
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < medicines.length) {
      await sleep(DELAY_MS);
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Classification complete!');
  console.log(`   Total processed : ${medicines.length}`);
  console.log(`   Updated         : ${updated}`);
  console.log(`   Confident (✓)   : ${confident}`);
  console.log(`   Needs review (?): ${uncertain}`);
  console.log(`   Errors          : ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Write uncertain list to file for review
  if (uncertainList.length > 0) {
    const fs = require('fs');
    const outFile = `uncertain-medicines-${Date.now()}.json`;
    fs.writeFileSync(outFile, JSON.stringify(uncertainList, null, 2));
    console.log(`⚠️  ${uncertain} medicines need manual review → saved to ${outFile}`);
    console.log('   Run the admin review UI to verify these.\n');
  }

  // Verify substitute groups created
  const { rows: groups } = await db.query(
    `SELECT COUNT(DISTINCT substitute_group_key) as groups,
            COUNT(*) FILTER (WHERE substitute_group_key IS NOT NULL) as with_key
     FROM medicines WHERE tenant_id = $1`,
    [TENANT_ID]
  );
  console.log(`📊 Substitute groups: ${groups[0].groups} unique groups across ${groups[0].with_key} medicines`);

  await db.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
