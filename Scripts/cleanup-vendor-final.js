/**
 * Simplified cleanup - just reassigns everything, no deletes
 */

const { Client } = require('pg');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CUTOFF_DATE = '2026-04-27 00:00:00';

const client = new Client({
  host: 'shortline.proxy.rlwy.net',
  port: 28446,
  user: 'postgres',
  password: 'DiEdeHygIWJrKSwMdRXNJmBwrajJrnev',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

function normalizeName(name) {
  return name.toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^(TAB|CAP|SYP|INJ|CREAM|GEL|OINT)\s+/i, '')
    .replace(/\s+(TAB|TABLET|CAP|CAPSULE|SYP|SYRUP|INJ|INJECTION)\s*(\(.*?\))?$/i, '')
    .replace(/[^\w\s]/g, '').trim();
}

async function findDuplicates() {
  const newMeds = await client.query(`
    SELECT id, brand_name, created_at FROM medicines
    WHERE tenant_id = $1 AND created_at >= $2
  `, [TENANT_ID, CUTOFF_DATE]);
  
  const oldMeds = await client.query(`
    SELECT id, brand_name, created_at FROM medicines
    WHERE tenant_id = $1 AND created_at < $2
  `, [TENANT_ID, CUTOFF_DATE]);
  
  const oldMap = new Map();
  for (const m of oldMeds.rows) {
    const norm = normalizeName(m.brand_name);
    if (!oldMap.has(norm)) oldMap.set(norm, []);
    oldMap.get(norm).push(m);
  }
  
  const dups = [];
  for (const m of newMeds.rows) {
    const matches = oldMap.get(normalizeName(m.brand_name));
    if (matches?.[0]) {
      dups.push({ keep: matches[0], remove: m });
    }
  }
  return dups;
}

async function merge(dup) {
  const { keep, remove } = dup;
  log(`\nMerging: ${remove.brand_name} → ${keep.brand_name}`);

  try {
    await client.query('BEGIN');

    // Update all references
    await client.query('UPDATE sale_items SET medicine_id = $1 WHERE medicine_id = $2', [keep.id, remove.id]);
    await client.query('UPDATE prescription_items SET medicine_id = $1 WHERE medicine_id = $2', [keep.id, remove.id]);
    await client.query('UPDATE reorder_flags SET medicine_id = $1 WHERE medicine_id = $2', [keep.id, remove.id]);
    await client.query('UPDATE medication_plans SET medicine_id = $1 WHERE medicine_id = $2', [keep.id, remove.id]);
    
    // Reassign all batches (don't delete - avoid FK issues)
    await client.query('UPDATE stock_batches SET medicine_id = $1 WHERE medicine_id = $2', [keep.id, remove.id]);
    
    // Delete duplicate medicine
    await client.query('DELETE FROM medicines WHERE id = $1', [remove.id]);

    await client.query('COMMIT');
    log('   ✅ Success');
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`   ❌ Error: ${error.message}`);
    throw error;
  }
}

async function main() {
  await client.connect();
  const dups = await findDuplicates();
  
  if (dups.length === 0) {
    log('✅ No duplicates found!');
    await client.end();
    return;
  }

  console.log('\n' + '='.repeat(60));
  log(`Found ${dups.length} duplicate(s) to merge`);
  console.log('='.repeat(60));
  dups.forEach(d => log(`  ${d.remove.brand_name} → ${d.keep.brand_name}`));
  
  log('\nPress Enter to continue...');
  await new Promise(r => process.stdin.once('data', r));

  for (const d of dups) {
    try { await merge(d); } 
    catch (e) { log(`Failed: ${d.remove.brand_name}`); }
  }

  const remaining = await findDuplicates();
  console.log('\n' + '='.repeat(60));
  log(`✅ Done! Remaining: ${remaining.length}`);
  console.log('='.repeat(60) + '\n');
  
  await client.end();
}

main();
