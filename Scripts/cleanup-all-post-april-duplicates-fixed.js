/**
 * cleanup-all-post-april-duplicates.js
 * 
 * This script removes ALL duplicate medicines and batches created after April 26, 2026.
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

function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

async function findDuplicateBatches() {
  log('🔍 Finding all duplicate batch numbers...');
  
  const result = await client.query(`
    WITH batch_meds AS (
      SELECT 
        sb.batch_number,
        sb.medicine_id,
        m.brand_name,
        m.created_at,
        ROW_NUMBER() OVER (PARTITION BY sb.batch_number ORDER BY m.created_at) as rn
      FROM stock_batches sb
      JOIN medicines m ON m.id = sb.medicine_id
      WHERE sb.tenant_id = $1
    )
    SELECT 
      batch_number,
      COUNT(DISTINCT medicine_id) as medicine_count,
      array_agg(medicine_id ORDER BY rn) as medicine_ids,
      array_agg(brand_name ORDER BY rn) as medicine_names,
      array_agg(created_at ORDER BY rn) as created_dates
    FROM batch_meds
    GROUP BY batch_number
    HAVING COUNT(DISTINCT medicine_id) > 1
    ORDER BY batch_number
  `, [TENANT_ID]);

  return result.rows;
}

function decideMedicineToKeep(batchInfo) {
  const { medicine_ids, medicine_names, created_dates } = batchInfo;
  
  let keepIndex = -1;
  for (let i = 0; i < created_dates.length; i++) {
    const createdAt = new Date(created_dates[i]);
    const cutoff = new Date(CUTOFF_DATE);
    
    if (createdAt < cutoff) {
      keepIndex = i;
      break;
    }
  }
  
  if (keepIndex === -1) {
    keepIndex = 0;
    log(`⚠️  Warning: No medicine for batch ${batchInfo.batch_number} created before ${CUTOFF_DATE}. Keeping oldest.`);
  }
  
  const keep = {
    id: medicine_ids[keepIndex],
    name: medicine_names[keepIndex],
    created_at: created_dates[keepIndex],
  };
  
  const remove = [];
  for (let i = 0; i < medicine_ids.length; i++) {
    if (i !== keepIndex) {
      remove.push({
        id: medicine_ids[i],
        name: medicine_names[i],
        created_at: created_dates[i],
      });
    }
  }
  
  return { keep, remove };
}

async function mergeMedicine(batchNumber, keep, remove) {
  log(`\n📦 Batch: ${batchNumber}`);
  log(`   Keep: ${keep.name} (created: ${keep.created_at})`);
  log(`   Remove: ${remove.name} (created: ${remove.created_at})`);
  
  let updates = {
    stock_batches_reassigned: 0,
    stock_batches_deleted: 0,
    sale_items: 0,
    prescription_items: 0,
  };

  try {
    await client.query('BEGIN');

    const keepBatch = await client.query(`
      SELECT id, quantity 
      FROM stock_batches 
      WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
    `, [keep.id, batchNumber, TENANT_ID]);

    const removeBatch = await client.query(`
      SELECT id, quantity
      FROM stock_batches 
      WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
    `, [remove.id, batchNumber, TENANT_ID]);

    if (removeBatch.rows.length > 0) {
      if (keepBatch.rows.length > 0) {
        const newQty = parseInt(keepBatch.rows[0].quantity) + parseInt(removeBatch.rows[0].quantity);
        await client.query(`
          UPDATE stock_batches 
          SET quantity = $1, updated_at = NOW()
          WHERE id = $2
        `, [newQty, keepBatch.rows[0].id]);
        
        log(`   ✓ Merged quantities: ${keepBatch.rows[0].quantity} + ${removeBatch.rows[0].quantity} = ${newQty}`);
        
        await client.query(`DELETE FROM stock_batches WHERE id = $1`, [removeBatch.rows[0].id]);
        updates.stock_batches_deleted = 1;
      } else {
        await client.query(`
          UPDATE stock_batches 
          SET medicine_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [keep.id, removeBatch.rows[0].id]);
        updates.stock_batches_reassigned = 1;
        log(`   ✓ Reassigned batch to keep medicine`);
      }
    }

    const saleResult = await client.query(`
      UPDATE sale_items SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.sale_items = saleResult.rowCount;

    const prescResult = await client.query(`
      UPDATE prescription_items SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.prescription_items = prescResult.rowCount;

    await client.query(`
      UPDATE reorder_flags SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`
      UPDATE medication_plans SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);

    await client.query(`
      DELETE FROM stock_batches 
      WHERE medicine_id = $1 AND tenant_id = $2
    `, [remove.id, TENANT_ID]);

    await client.query(`DELETE FROM medicines WHERE id = $1`, [remove.id]);

    await client.query('COMMIT');
    log(`   ✅ Merged: ${JSON.stringify(updates)}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`   ❌ Error: ${error.message}`);
    throw error;
  }

  return updates;
}

async function main() {
  try {
    await client.connect();
    log('🔌 Connected to database');

    const duplicateBatches = await findDuplicateBatches();
    
    if (duplicateBatches.length === 0) {
      log('✅ No duplicate batch numbers found!');
      await client.end();
      return;
    }

    log(`\nFound ${duplicateBatches.length} batch numbers with duplicates:\n`);
    
    for (const batch of duplicateBatches.slice(0, 10)) {
      log(`Batch: ${batch.batch_number} → ${batch.medicine_count} medicines`);
      batch.medicine_names.forEach((name, idx) => {
        const date = new Date(batch.created_dates[idx]).toISOString().split('T')[0];
        log(`  - ${name} (created: ${date})`);
      });
    }
    
    if (duplicateBatches.length > 10) {
      log(`... and ${duplicateBatches.length - 10} more`);
    }

    log('\n⚠️  CLEANUP STRATEGY:');
    log(`Keep: Medicines created BEFORE ${CUTOFF_DATE}`);
    log(`Delete: Medicines created AFTER April 26, 2026`);
    log('\nPress Enter to continue or Ctrl+C to cancel...\n');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    log('\n🚀 Starting cleanup...\n');

    let totalMerged = 0;

    for (const batchInfo of duplicateBatches) {
      try {
        const { keep, remove } = decideMedicineToKeep(batchInfo);
        
        for (const removeItem of remove) {
          await mergeMedicine(batchInfo.batch_number, keep, removeItem);
          totalMerged++;
        }
      } catch (error) {
        log(`❌ Failed batch ${batchInfo.batch_number}: ${error.message}`);
      }
    }

    log(`\n✅ Cleanup complete! Merged: ${totalMerged} duplicates`);

    const dupCheck = await client.query(`
      SELECT COUNT(*) as count FROM (
        SELECT batch_number FROM stock_batches WHERE tenant_id = $1
        GROUP BY batch_number HAVING COUNT(DISTINCT medicine_id) > 1
      ) subq
    `, [TENANT_ID]);
    
    log(`\n📊 Remaining duplicate batches: ${dupCheck.rows[0].count}`);

    await client.end();
    log('\n✅ Done! 🎉');
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

main();
