/**
 * cleanup-all-post-april-duplicates.js
 * 
 * This script removes ALL duplicate medicines and batches created after April 26, 2026.
 * Strategy:
 * 1. For each batch number that exists in multiple medicines:
 *    - Keep the medicine created BEFORE April 27, 2026 (original data)
 *    - Delete medicines created AFTER April 26, 2026 (vendor imports)
 * 2. Merge stock quantities where needed
 * 3. Update all references (sales, prescriptions, etc.)
 * 
 * Usage:
 *   node cleanup-all-post-april-duplicates.js
 */

const { Client } = require('pg');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const CUTOFF_DATE = '2026-04-27 00:00:00'; // Keep everything before this, delete after

const client = new Client({
  host: 'shortline.proxy.rlwy.net',
  port: 28446,
  user: 'postgres',
  password: 'DiEdeHygIWJrKSwMdRXNJmBwrajJrnev',
  database: 'railway',
  ssl: { rejectUnauthorized: false },
});

// Helper function for logging
function log(message, data = null) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

// Find all duplicate batch numbers
async function findDuplicateBatches() {
  log('🔍 Finding all duplicate batch numbers...');
  
  const result = await client.query(`
    SELECT 
      sb.batch_number,
      COUNT(DISTINCT sb.medicine_id) as medicine_count,
      array_agg(DISTINCT m.id ORDER BY m.created_at) as medicine_ids,
      array_agg(DISTINCT m.brand_name ORDER BY m.created_at) as medicine_names,
      array_agg(DISTINCT m.created_at ORDER BY m.created_at) as created_dates
    FROM stock_batches sb
    JOIN medicines m ON m.id = sb.medicine_id
    WHERE sb.tenant_id = $1
    GROUP BY sb.batch_number
    HAVING COUNT(DISTINCT sb.medicine_id) > 1
    ORDER BY sb.batch_number
  `, [TENANT_ID]);

  return result.rows;
}

// Determine which medicine to keep and which to delete for a batch
function decideMedicineToKeep(batchInfo) {
  const { medicine_ids, medicine_names, created_dates } = batchInfo;
  
  // Find the oldest medicine (created before cutoff)
  let keepIndex = -1;
  for (let i = 0; i < created_dates.length; i++) {
    const createdAt = new Date(created_dates[i]);
    const cutoff = new Date(CUTOFF_DATE);
    
    if (createdAt < cutoff) {
      keepIndex = i;
      break; // Keep the first (oldest) one before cutoff
    }
  }
  
  // If no medicine was created before cutoff, keep the oldest one
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

// Merge duplicate medicine
async function mergeMedicine(batchNumber, keep, remove) {
  log(`\n📦 Batch: ${batchNumber}`);
  log(`   Keep: ${keep.name} (${keep.id}, created: ${keep.created_at})`);
  log(`   Remove: ${remove.name} (${remove.id}, created: ${remove.created_at})`);
  
  let updates = {
    stock_batches_reassigned: 0,
    stock_batches_deleted: 0,
    sale_items: 0,
    prescription_items: 0,
    reorder_flags: 0,
    medication_plans: 0,
  };

  try {
    await client.query('BEGIN');

    // 1. Check if keep medicine already has this batch
    const keepBatch = await client.query(`
      SELECT id, quantity 
      FROM stock_batches 
      WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
    `, [keep.id, batchNumber, TENANT_ID]);

    // 2. Get the duplicate batch to merge
    const removeBatch = await client.query(`
      SELECT id, quantity, expiry_date, purchase_price, mrp, sale_rate
      FROM stock_batches 
      WHERE medicine_id = $1 AND batch_number = $2 AND tenant_id = $3
    `, [remove.id, batchNumber, TENANT_ID]);

    if (removeBatch.rows.length > 0) {
      if (keepBatch.rows.length > 0) {
        // Keep medicine already has this batch - merge quantities
        const newQty = parseInt(keepBatch.rows[0].quantity) + parseInt(removeBatch.rows[0].quantity);
        await client.query(`
          UPDATE stock_batches 
          SET quantity = $1, updated_at = NOW()
          WHERE id = $2
        `, [newQty, keepBatch.rows[0].id]);
        
        log(`   ✓ Merged quantities: ${keepBatch.rows[0].quantity} + ${removeBatch.rows[0].quantity} = ${newQty}`);
        
        // Delete the duplicate batch
        await client.query(`DELETE FROM stock_batches WHERE id = $1`, [removeBatch.rows[0].id]);
        updates.stock_batches_deleted = 1;
      } else {
        // Keep medicine doesn't have this batch - reassign it
        await client.query(`
          UPDATE stock_batches 
          SET medicine_id = $1, updated_at = NOW()
          WHERE id = $2
        `, [keep.id, removeBatch.rows[0].id]);
        updates.stock_batches_reassigned = 1;
        log(`   ✓ Reassigned batch to keep medicine`);
      }
    }

    // 3. Update sale_items
    const saleResult = await client.query(`
      UPDATE sale_items
      SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.sale_items = saleResult.rowCount;

    // 4. Update prescription_items
    const prescResult = await client.query(`
      UPDATE prescription_items
      SET medicine_id = $1
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.prescription_items = prescResult.rowCount;

    // 5. Update reorder_flags
    const reorderResult = await client.query(`
      UPDATE reorder_flags
      SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.reorder_flags = reorderResult.rowCount;

    // 6. Update medication_plans
    const medPlanResult = await client.query(`
      UPDATE medication_plans
      SET medicine_id = $1, updated_at = NOW()
      WHERE medicine_id = $2 AND tenant_id = $3
    `, [keep.id, remove.id, TENANT_ID]);
    updates.medication_plans = medPlanResult.rowCount;

    // 7. Delete any remaining batches for the duplicate medicine
    const remainingBatches = await client.query(`
      DELETE FROM stock_batches 
      WHERE medicine_id = $1 AND tenant_id = $2
      RETURNING id
    `, [remove.id, TENANT_ID]);
    
    if (remainingBatches.rowCount > 0) {
      log(`   ✓ Deleted ${remainingBatches.rowCount} remaining batches`);
    }

    // 8. Delete duplicate medicine
    await client.query(`
      DELETE FROM medicines WHERE id = $1
    `, [remove.id]);

    await client.query('COMMIT');
    
    log(`   ✅ Merged successfully: ${JSON.stringify(updates)}`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    log(`   ❌ Error merging: ${error.message}`);
    throw error;
  }

  return updates;
}

// Generate summary report
async function generateSummaryReport() {
  log('\n📊 FINAL SUMMARY REPORT\n');
  
  // Count remaining duplicates
  const dupBatches = await client.query(`
    SELECT COUNT(*) as count
    FROM (
      SELECT batch_number
      FROM stock_batches
      WHERE tenant_id = $1
      GROUP BY batch_number
      HAVING COUNT(DISTINCT medicine_id) > 1
    ) subq
  `, [TENANT_ID]);
  
  // Count total medicines
  const totalMeds = await client.query(`
    SELECT COUNT(*) as count FROM medicines WHERE tenant_id = $1
  `, [TENANT_ID]);
  
  // Count total batches
  const totalBatches = await client.query(`
    SELECT COUNT(*) as count FROM stock_batches WHERE tenant_id = $1 AND quantity > 0
  `, [TENANT_ID]);
  
  // Count medicines created after April 26
  const postCutoffMeds = await client.query(`
    SELECT COUNT(*) as count 
    FROM medicines 
    WHERE tenant_id = $1 AND created_at >= $2
  `, [TENANT_ID, CUTOFF_DATE]);
  
  log(`✅ Duplicate batch numbers remaining: ${dupBatches.rows[0].count}`);
  log(`✅ Total medicines: ${totalMeds.rows[0].count}`);
  log(`✅ Total batches (qty > 0): ${totalBatches.rows[0].count}`);
  log(`✅ Medicines created after ${CUTOFF_DATE}: ${postCutoffMeds.rows[0].count}`);
  
  if (dupBatches.rows[0].count > 0) {
    log('\n⚠️  WARNING: Some duplicate batch numbers still exist!');
    log('Run the script again or investigate manually.');
  } else {
    log('\n🎉 SUCCESS! All duplicate batch numbers have been resolved!');
  }
}

async function main() {
  try {
    await client.connect();
    log('🔌 Connected to database');

    // Find all duplicate batches
    const duplicateBatches = await findDuplicateBatches();
    
    if (duplicateBatches.length === 0) {
      log('✅ No duplicate batch numbers found!');
      await client.end();
      return;
    }

    log(`\nFound ${duplicateBatches.length} batch numbers with duplicates:\n`);
    
    // Show summary
    for (const batch of duplicateBatches) {
      log(`Batch: ${batch.batch_number} → ${batch.medicine_count} medicines`);
      batch.medicine_names.forEach((name, idx) => {
        const date = new Date(batch.created_dates[idx]).toISOString().split('T')[0];
        log(`  - ${name} (created: ${date})`);
      });
    }

    log('\n⚠️  CLEANUP STRATEGY:');
    log(`Keep: Medicines created BEFORE ${CUTOFF_DATE} (original data)`);
    log(`Delete: Medicines created AFTER April 26, 2026 (vendor imports)`);
    log('\nThis will merge the duplicates. Continue? (Ctrl+C to cancel)');
    log('Press Enter to continue...\n');
    
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });

    log('\n🚀 Starting cleanup...\n');

    let totalMerged = 0;
    let totalErrors = 0;

    for (const batchInfo of duplicateBatches) {
      try {
        const { keep, remove } = decideMedicineToKeep(batchInfo);
        
        for (const removeItem of remove) {
          await mergeMedicine(batchInfo.batch_number, keep, removeItem);
          totalMerged++;
        }
      } catch (error) {
        log(`❌ Failed to process batch ${batchInfo.batch_number}: ${error.message}`);
        totalErrors++;
      }
    }

    log(`\n✅ Cleanup complete!`);
    log(`   Merged: ${totalMerged} duplicate medicines`);
    log(`   Errors: ${totalErrors}`);

    // Generate final report
    await generateSummaryReport();

    await client.end();
    log('\n✅ All done! 🎉');
    
  } catch (error) {
    log(`❌ Fatal error: ${error.message}`);
    console.error(error);
    await client.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
