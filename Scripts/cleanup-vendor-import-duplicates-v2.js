/**
 * cleanup-vendor-import-duplicates-v2.js
 * Fixed version that handles sale_items foreign key constraints
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
  log(`   Keep: ${keep.brand_name}`);
  log(`   Remove: ${remove.brand_name}`);

  try {
    await client.query('BEGIN');

    // CRITICAL FIX: Update sale_items FIRST before touching batches
    // This prevents foreign key violations
    const saleItemsUpdate = await client.query(`
      UPDATE sale_items
      SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    
    if (saleItemsUpdate.rowCount > 0) {
      log(`   ✓ Updated ${saleItemsUpdate.rowCount} sale items`);
    }

    // Update prescription_items
    await client.query(`
      UPDATE prescription_items SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    // Update other references
    await client.query(`
      UPDATE reorder_flags SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`
      UPDATE medication_plans SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    // NOW handle batches
    const removeBatches = await client.query(`
      SELECT batch_number, quantity, id
      FROM stock_batches
      WHERE medicine_id = $1 AND tenant_id = $2
    `, [remove.id, TENANT_ID]);
    
    let batches_moved = 0;
    let batches_merged = 0;
    
    for (const batch of removeBatches.rows) {
      const existingBatch = await client.query(`
        SELECT id, quantity
        FROM stock_batches
        WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
      `, [keep.id, batch.batch_number, TENANT_ID]);
      
      if (existingBatch.rows.length > 0) {
        // Merge quantities
        const newQty = parseInt(existingBatch.rows[0].quantity) + parseInt(batch.quantity);
        await client.query(`
          UPDATE stock_batches
          SET quantity = $1, updated_at = NOW()
          WHERE id = $2
        `, [newQty, existingBatch.rows[0].id]);
        
        // Update any sale_items that reference the old batch to use the keep batch
        await client.query(`
          UPDATE sale_items
          SET stock_batch_id = $1
          WHERE stock_batch_id = $2 AND tenant_id = $3
        `, [existingBatch.rows[0].id, batch.id, TENANT_ID]);
        
        // Now safe to delete
        await client.query(`DELETE FROM stock_batches WHERE id = $1`, [batch.id]);
        batches_merged++;
      } else {
        // Move batch to keep medicine
        await client.query(`
          UPDATE stock_batches
          SET medicine_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [keep.id, batch.id]);
        batches_moved++;
      }
    }

    // Finally, delete duplicate medicine
    await client.query(`DELETE FROM medicines WHERE id = $1`, [remove.id]);

    await client.query('COMMIT');
    
    log(`   ✅ Success: ${batches_moved} batches moved, ${batches_merged} batches merged`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`   ❌ Error: ${error.message}`);
    throw error;
  }
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
    log(`Found ${duplicates.length} vendor import duplicate(s)`);
    console.log('='.repeat(80) + '\n');
    
    for (const dup of duplicates) {
      log(`• Keep: ${dup.keep.brand_name} | Remove: ${dup.remove.brand_name}`);
    }

    log('\nPress Enter to continue or Ctrl+C to cancel...\n');
    await new Promise(resolve => process.stdin.once('data', resolve));

    log('🚀 Starting cleanup...\n');

    for (const dup of duplicates) {
      try {
        await mergeMedicine(dup);
      } catch (error) {
        log(`❌ Failed: ${dup.remove.brand_name} - ${error.message}`);
      }
    }

    const remaining = await findVendorImportDuplicates();
    
    console.log('\n' + '='.repeat(80));
    log(`✅ Complete! Remaining duplicates: ${remaining.length}`);
    console.log('='.repeat(80) + '\n');

    await client.end();
    
  } catch (error) {
    log(`❌ Fatal: ${error.message}`);
    await client.end();
    process.exit(1);
  }
}

main();
