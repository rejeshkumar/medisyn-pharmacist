/**
 * cleanup-vendor-import-duplicates.js
 * 
 * TARGETED CLEANUP: Only removes duplicates created AFTER April 26, 2026
 * that are fuzzy-matched duplicates of existing medicines.
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

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function normalizeName(name) {
  return name
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/^(TAB|CAP|SYP|INJ|CREAM|GEL|OINT)\s+/i, '')
    .replace(/\s+(TAB|TABLET|CAP|CAPSULE|SYP|SYRUP|INJ|INJECTION)\s*(\(.*?\))?$/i, '')
    .replace(/[^\w\s]/g, '')
    .trim();
}

async function findVendorImportDuplicates() {
  log('🔍 Finding vendor import duplicates (created after April 26)...');
  
  const newMeds = await client.query(`
    SELECT id, brand_name, created_at
    FROM medicines
    WHERE tenant_id = $1 AND created_at >= $2
    ORDER BY created_at
  `, [TENANT_ID, CUTOFF_DATE]);
  
  const oldMeds = await client.query(`
    SELECT id, brand_name, created_at
    FROM medicines
    WHERE tenant_id = $1 AND created_at < $2
    ORDER BY created_at
  `, [TENANT_ID, CUTOFF_DATE]);
  
  log(`   Found ${newMeds.rows.length} medicines created after April 26`);
  log(`   Found ${oldMeds.rows.length} medicines created before April 27`);
  
  const oldMedMap = new Map();
  for (const med of oldMeds.rows) {
    const normalized = normalizeName(med.brand_name);
    if (!oldMedMap.has(normalized)) {
      oldMedMap.set(normalized, []);
    }
    oldMedMap.get(normalized).push(med);
  }
  
  const duplicates = [];
  for (const newMed of newMeds.rows) {
    const normalized = normalizeName(newMed.brand_name);
    const matches = oldMedMap.get(normalized);
    
    if (matches && matches.length > 0) {
      duplicates.push({
        keep: matches[0],
        remove: newMed,
        normalized: normalized,
      });
    }
  }
  
  return duplicates;
}

async function mergeMedicine(dup) {
  const { keep, remove, normalized } = dup;
  
  log(`\n📦 Normalized: ${normalized}`);
  log(`   Keep: ${keep.brand_name} (created: ${keep.created_at})`);
  log(`   Remove: ${remove.brand_name} (created: ${remove.created_at})`);
  
  let stats = {
    batches_moved: 0,
    batches_merged: 0,
    sale_items: 0,
  };

  try {
    await client.query('BEGIN');

    const removeBatches = await client.query(`
      SELECT batch_number, quantity, id
      FROM stock_batches
      WHERE medicine_id = $1 AND tenant_id = $2
    `, [remove.id, TENANT_ID]);
    
    for (const batch of removeBatches.rows) {
      const existingBatch = await client.query(`
        SELECT id, quantity
        FROM stock_batches
        WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
      `, [keep.id, batch.batch_number, TENANT_ID]);
      
      if (existingBatch.rows.length > 0) {
        const newQty = parseInt(existingBatch.rows[0].quantity) + parseInt(batch.quantity);
        await client.query(`
          UPDATE stock_batches
          SET quantity = $1, updated_at = NOW()
          WHERE id = $2
        `, [newQty, existingBatch.rows[0].id]);
        
        await client.query(`DELETE FROM stock_batches WHERE id = $1`, [batch.id]);
        stats.batches_merged++;
      } else {
        await client.query(`
          UPDATE stock_batches
          SET medicine_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [keep.id, batch.id]);
        stats.batches_moved++;
      }
    }

    const saleResult = await client.query(`
      UPDATE sale_items SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    stats.sale_items = saleResult.rowCount;

    await client.query(`
      UPDATE prescription_items SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`
      UPDATE reorder_flags SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`
      UPDATE medication_plans SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`DELETE FROM medicines WHERE id = $1`, [remove.id]);

    await client.query('COMMIT');
    
    log(`   ✅ Success: ${stats.batches_moved} batches moved, ${stats.batches_merged} batches merged`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`   ❌ Error: ${error.message}`);
    throw error;
  }

  return stats;
}

async function main() {
  try {
    await client.connect();
    log('🔌 Connected to database');

    const duplicates = await findVendorImportDuplicates();
    
    if (duplicates.length === 0) {
      log('\n✅ No vendor import duplicates found!');
      await client.end();
      return;
    }

    console.log('\n' + '='.repeat(80));
    log(`Found ${duplicates.length} vendor import duplicates to clean up:`);
    console.log('='.repeat(80) + '\n');
    
    for (const dup of duplicates) {
      log(`• ${dup.normalized}`);
      log(`  Keep: ${dup.keep.brand_name} (Apr 26)`);
      log(`  Remove: ${dup.remove.brand_name} (${new Date(dup.remove.created_at).toISOString().split('T')[0]})`);
    }

    log('\n⚠️  This will merge the above duplicates.');
    log('Press Enter to continue or Ctrl+C to cancel...\n');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    log('\n🚀 Starting cleanup...\n');

    let totalMerged = 0;
    for (const dup of duplicates) {
      try {
        await mergeMedicine(dup);
        totalMerged++;
      } catch (error) {
        log(`❌ Failed: ${dup.remove.brand_name}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    log(`✅ Cleanup complete! Merged ${totalMerged} vendor import duplicates`);
    console.log('='.repeat(80));

    const remaining = await findVendorImportDuplicates();
    log(`\n📊 Remaining vendor import duplicates: ${remaining.length}`);

    await client.end();
    log('\n✅ Done! 🎉\n');
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

main();
