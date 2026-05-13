/**
 * cleanup-duplicate-medicines.js
 * 
 * This script fixes the duplicate medicine issue in MediSyn database:
 * 1. Identifies duplicate medicines (same medicine, different names)
 * 2. Merges stock batches to the correct medicine
 * 3. Updates sales/prescription references
 * 4. Deletes duplicate medicine records
 * 
 * Usage:
 *   node cleanup-duplicate-medicines.js
 */

const { Client } = require('pg');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

const client = new Client({
  host: 'shortline.proxy.rlwy.net',
  port: 28446,
  user: 'postgres',
  password: 'gAtHLENrqUMqMkkjuVEoqKqVcayvQZUm',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

// Normalize medicine name for comparison
function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^(TAB|CAP|SYP|INJ|CREAM|GEL|OINT)\s+/i, '')
    .replace(/\s+(TAB|TABLET|CAP|CAPSULE|SYP|SYRUP|INJ|INJECTION)\s*(\(.*?\))?$/i, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

async function findDuplicates() {
  console.log('🔍 Finding duplicate medicines...\n');
  
  const result = await client.query(`
    SELECT id, brand_name, molecule, manufacturer, created_at
    FROM medicines
    WHERE tenant_id = $1
    ORDER BY brand_name
  `, [TENANT_ID]);

  const normalized = new Map();
  
  for (const med of result.rows) {
    const norm = normalizeName(med.brand_name);
    if (!normalized.has(norm)) {
      normalized.set(norm, []);
    }
    normalized.get(norm).push(med);
  }

  const duplicates = [];
  for (const [norm, meds] of normalized) {
    if (meds.length > 1) {
      // Keep the oldest one (original from April 26 data load)
      meds.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      duplicates.push({
        normalized: norm,
        keep: meds[0],
        remove: meds.slice(1),
      });
    }
  }

  return duplicates;
}

async function mergeMedicine(keep, remove) {
  console.log(`\n📦 Merging: "${remove.brand_name}" → "${keep.brand_name}"`);
  
  let updates = {
    stock_batches: 0,
    sale_items: 0,
    prescription_items: 0,
    reorder_flags: 0,
  };

  try {
    await client.query('BEGIN');

    // 1. Update stock_batches
    const batchResult = await client.query(`
      UPDATE stock_batches 
      SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.stock_batches = batchResult.rowCount;

    // 2. Update sale_items
    const saleResult = await client.query(`
      UPDATE sale_items
      SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.sale_items = saleResult.rowCount;

    // 3. Update prescription_items
    const prescResult = await client.query(`
      UPDATE prescription_items
      SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.prescription_items = prescResult.rowCount;

    // 4. Update reorder_flags
    const reorderResult = await client.query(`
      UPDATE reorder_flags
      SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.reorder_flags = reorderResult.rowCount;

    // 5. Delete duplicate medicine
    await client.query(`
      DELETE FROM medicines WHERE id = $1
    `, [remove.id]);

    await client.query('COMMIT');
    
    console.log(`   ✅ Updated: ${updates.stock_batches} batches, ${updates.sale_items} sales, ${updates.prescription_items} prescriptions, ${updates.reorder_flags} reorder flags`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`   ❌ Error merging: ${error.message}`);
    throw error;
  }

  return updates;
}

async function checkBatchIntegrity() {
  console.log('\n🔍 Checking batch number integrity...\n');
  
  const duplicateBatches = await client.query(`
    SELECT 
      batch_number,
      COUNT(DISTINCT medicine_id) as medicine_count,
      array_agg(DISTINCT m.brand_name) as medicine_names
    FROM stock_batches sb
    JOIN medicines m ON m.id = sb.medicine_id
    WHERE sb.tenant_id = $1
    GROUP BY batch_number
    HAVING COUNT(DISTINCT medicine_id) > 1
  `, [TENANT_ID]);

  if (duplicateBatches.rows.length > 0) {
    console.log('⚠️  WARNING: The following batch numbers are still assigned to multiple medicines:');
    for (const row of duplicateBatches.rows) {
      console.log(`   Batch: ${row.batch_number}`);
      console.log(`   Medicines: ${row.medicine_names.join(', ')}`);
      console.log('');
    }
    return false;
  } else {
    console.log('✅ All batch numbers are unique per medicine');
    return true;
  }
}

async function main() {
  try {
    await client.connect();
    console.log('🔌 Connected to database\n');

    const duplicates = await findDuplicates();
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate medicines found!');
      await client.end();
      return;
    }

    console.log(`Found ${duplicates.length} sets of duplicate medicines:\n`);
    
    for (const dup of duplicates) {
      console.log(`📋 Normalized: ${dup.normalized}`);
      console.log(`   Keep: ${dup.keep.brand_name} (ID: ${dup.keep.id}, Created: ${dup.keep.created_at})`);
      dup.remove.forEach(r => {
        console.log(`   Remove: ${r.brand_name} (ID: ${r.id}, Created: ${r.created_at})`);
      });
    }

    console.log('\n⚠️  This will merge the duplicate medicines. Continue? (Ctrl+C to cancel)');
    console.log('Press Enter to continue...');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    console.log('\n🚀 Starting cleanup...\n');

    let totalMerged = 0;
    for (const dup of duplicates) {
      for (const remove of dup.remove) {
        await mergeMedicine(dup.keep, remove);
        totalMerged++;
      }
    }

    console.log(`\n✅ Successfully merged ${totalMerged} duplicate medicines`);

    await checkBatchIntegrity();

    await client.end();
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    await client.end();
    process.exit(1);
  }
}

main();
