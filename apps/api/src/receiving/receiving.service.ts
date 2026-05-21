import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { VerifyBatchDto } from './dto/verify-batch.dto';

@Injectable()
export class ReceivingService {
  constructor(private dataSource: DataSource) {}

  async getPendingBatches(tenantId: string, poId?: string) {
    let query = `
      SELECT 
        sb.id,
        sb.po_id,
        po.po_number,
        sb.medicine_id,
        m.brand_name as medicine_name,
        m.molecule,
        sb.batch_number as batch_no,
        sb.expiry_date,
        sb.ordered_qty,
        COALESCE(sb.received_qty, sb.quantity) as received_qty,
        sb.purchase_price,
        sb.sale_rate as mrp,
        sb.verification_status,
        sb.created_at as received_at,
        s.name as supplier_name
      FROM stock_batches sb
      LEFT JOIN medicines m ON m.id = sb.medicine_id
      LEFT JOIN purchase_orders po ON po.id = sb.po_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE sb.tenant_id = $1
        AND sb.verification_status = 'pending'
    `;

    const params: any[] = [tenantId];

    if (poId) {
      query += ` AND sb.po_id = $2`;
      params.push(poId);
    }

    query += ` ORDER BY sb.created_at DESC`;

    const batches = await this.dataSource.query(query, params);

    return {
      total: batches.length,
      batches,
    };
  }

  async verifyBatch(
    verifyDto: VerifyBatchDto,
    userId: string,
    tenantId: string,
  ) {
    const { batch_id, verified_qty, rejected_qty, discrepancy_notes } = verifyDto;

    const batch = await this.dataSource.query(
      `SELECT * FROM stock_batches WHERE id = $1 AND tenant_id = $2`,
      [batch_id, tenantId],
    );

    if (!batch || batch.length === 0) {
      throw new NotFoundException('Stock batch not found');
    }

    const batchData = batch[0];
    const receivedQty = batchData.received_qty || batchData.quantity;
    const rejectedQty = rejected_qty || 0;

    // Allow for small floating point differences (0.01 tolerance)
    const totalQty = verified_qty + rejectedQty;
    if (Math.abs(totalQty - receivedQty) > 0.01) {
      throw new BadRequestException(
        `Verified (${verified_qty}) + Rejected (${rejectedQty}) must equal Received (${receivedQty})`
      );
    }

    let verificationStatus: string;
    if (verified_qty === receivedQty) {
      verificationStatus = 'verified';
    } else if (verified_qty === 0) {
      verificationStatus = 'rejected';
    } else {
      verificationStatus = 'partial';
    }

    await this.dataSource.query(
      `
      UPDATE stock_batches 
      SET 
        verified_qty = $1,
        rejected_qty = $2,
        quantity = $3,
        verification_status = $4,
        verified_by = $5,
        verified_at = NOW(),
        discrepancy_notes = $6
      WHERE id = $7
      `,
      [
        verified_qty,
        rejectedQty,
        verified_qty,
        verificationStatus,
        userId,
        discrepancy_notes || null,
        batch_id,
      ],
    );

    if (rejectedQty > 0 || discrepancy_notes) {
      await this.logDiscrepancy(
        batch_id,
        tenantId,
        batchData.po_id,
        receivedQty,
        verified_qty,
        rejectedQty,
        discrepancy_notes,
        userId,
      );
    }

    // After verification, check if all batches for this PO are verified
    if (batchData.po_id) {
      await this.checkAndUpdatePOStatus(batchData.po_id, tenantId);
    }

    // For walk-in / CSV batches (no PO), create Finance upcoming payment on verify
    if (!batchData.po_id && verified_qty > 0 && batchData.purchase_price > 0) {
      try {
        const amount = verified_qty * Number(batchData.purchase_price);
        // Get supplier name
        let supplierName = 'Supplier';
        if (batchData.supplier_id) {
          const sup = await this.dataSource.query(
            `SELECT name FROM suppliers WHERE id = $1`,
            [batchData.supplier_id],
          );
          if (sup.length > 0) supplierName = sup[0].name;
        }
        // Check if payment already exists for this batch
        const existing = await this.dataSource.query(
          `SELECT id FROM upcoming_payments
           WHERE source_type = 'stock_batch' AND source_id = $1 AND tenant_id = $2`,
          [batch_id, tenantId],
        );
        if (existing.length === 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + 30); // default 30 days
          await this.dataSource.query(
            `INSERT INTO upcoming_payments (
               id, tenant_id, payment_type, description, amount,
               due_date, is_urgent, is_paid, source_type, source_id,
               created_at, updated_at
             ) VALUES (
               gen_random_uuid(), $1, 'purchase', $2, $3,
               $4, false, false, 'stock_batch', $5, NOW(), NOW()
             )`,
            [
              tenantId,
              `${supplierName} — Batch ${batchData.batch_number}`,
              amount,
              dueDate.toISOString().split('T')[0],
              batch_id,
            ],
          );
        } else {
          // Update amount if already exists (partial re-verify)
          await this.dataSource.query(
            `UPDATE upcoming_payments SET amount = $1, updated_at = NOW()
             WHERE source_type = 'stock_batch' AND source_id = $2 AND tenant_id = $3`,
            [amount, batch_id, tenantId],
          );
        }
      } catch (finErr) {
        console.error('Finance auto-entry failed for walk-in batch (non-fatal):', finErr);
      }
    }

    return {
      success: true,
      batch_id,
      verification_status: verificationStatus,
      verified_qty,
      rejected_qty,
      message: `Batch verified: ${verified_qty} units accepted, ${rejectedQty} rejected`,
    };
  }

  // Check if all batches for a PO are verified, then update PO and create payment
  private async checkAndUpdatePOStatus(poId: string, tenantId: string) {
    try {
      // Count total vs verified batches for this PO
      const batchStats = await this.dataSource.query(
        `
        SELECT 
          COUNT(*) as total_batches,
          COUNT(CASE WHEN verification_status IN ('verified', 'partial') THEN 1 END) as verified_batches
        FROM stock_batches
        WHERE po_id = $1 AND tenant_id = $2
        `,
        [poId, tenantId]
      );

      const stats = batchStats[0];
      
      // If all batches are verified
      if (stats.total_batches > 0 && stats.total_batches === stats.verified_batches) {
        // Get PO details
        const poDetails = await this.dataSource.query(
          `SELECT * FROM purchase_orders WHERE id = $1 AND tenant_id = $2`,
          [poId, tenantId]
        );

        if (poDetails.length === 0) return;

        const po = poDetails[0];

        // Update PO status to 'received'
        await this.dataSource.query(
          `
          UPDATE purchase_orders 
          SET 
            status = 'received',
            receiving_status = 'complete',
            items_received_count = total_items_count,
            updated_at = NOW()
          WHERE id = $1
          `,
          [poId]
        );

        // Create upcoming payment if credit purchase
        if (po.credit_days && po.credit_days > 0) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + po.credit_days);

          // Check if payment already exists
          const existingPayment = await this.dataSource.query(
            `SELECT id FROM upcoming_payments WHERE source_type = 'purchase_order' AND source_id = $1`,
            [poId]
          );

          if (existingPayment.length === 0) {
            await this.dataSource.query(
              `
              INSERT INTO upcoming_payments (
                id, tenant_id, payment_type, description, amount, 
                due_date, is_urgent, is_paid, source_type, source_id, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, 'purchase', $2, $3, 
                $4, false, false, 'purchase_order', $5, NOW(), NOW()
              )
              `,
              [
                tenantId,
                `Payment for ${po.po_number} - ${po.supplier_name || 'Supplier'}`,
                po.total_amount || 0,
                dueDate.toISOString().split('T')[0],
                poId
              ]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error updating PO status:', error);
      // Don't throw - verification already succeeded, this is just a bonus
    }
  }

  // Check if all batches for a PO are verified, then update PO and create payment
  async bulkVerifyBatches(
    batches: VerifyBatchDto[],
    userId: string,
    tenantId: string,
  ) {
    const results = [];

    for (const batch of batches) {
      try {
        const result = await this.verifyBatch(batch, userId, tenantId);
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          batch_id: batch.batch_id,
          error: error.message,
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return {
      total: batches.length,
      successful,
      failed,
      results,
    };
  }

  async getDiscrepancies(
    tenantId: string,
    poId?: string,
    fromDate?: string,
    toDate?: string,
  ) {
    let query = `
      SELECT 
        vd.id,
        vd.discrepancy_type,
        vd.expected_qty,
        vd.actual_qty,
        vd.variance_qty,
        vd.variance_value,
        vd.notes,
        vd.reported_at,
        vd.resolution_status,
        sb.batch_number as batch_no,
        m.brand_name as medicine_name,
        po.po_number,
        s.name as supplier_name
      FROM verification_discrepancies vd
      LEFT JOIN stock_batches sb ON sb.id = vd.stock_batch_id
      LEFT JOIN medicines m ON m.id = sb.medicine_id
      LEFT JOIN purchase_orders po ON po.id = vd.po_id
      LEFT JOIN suppliers s ON s.id = po.supplier_id
      WHERE vd.tenant_id = $1
    `;

    const params: any[] = [tenantId];
    let paramIndex = 2;

    if (poId) {
      query += ` AND vd.po_id = $${paramIndex}`;
      params.push(poId);
      paramIndex++;
    }

    if (fromDate) {
      query += ` AND vd.reported_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      query += ` AND vd.reported_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    query += ` ORDER BY vd.reported_at DESC`;

    const discrepancies = await this.dataSource.query(query, params);

    return {
      total: discrepancies.length,
      discrepancies,
    };
  }

  async getVerificationSummary(poId: string, tenantId: string) {
    const summary = await this.dataSource.query(
      `
      SELECT 
        COUNT(*) as total_batches,
        SUM(ordered_qty) as total_ordered,
        SUM(received_qty) as total_received,
        SUM(verified_qty) as total_verified,
        SUM(rejected_qty) as total_rejected,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) as verified_count,
        COUNT(CASE WHEN verification_status = 'partial' THEN 1 END) as partial_count,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) as rejected_count
      FROM stock_batches
      WHERE po_id = $1 AND tenant_id = $2
      `,
      [poId, tenantId],
    );

    return summary[0] || {};
  }

  private async logDiscrepancy(
    batchId: string,
    tenantId: string,
    poId: string,
    expectedQty: number,
    actualQty: number,
    varianceQty: number,
    notes: string,
    userId: string,
  ) {
    let discrepancyType = 'other';
    if (varianceQty > 0 && actualQty < expectedQty) {
      discrepancyType = 'short_supply';
    } else if (notes?.toLowerCase().includes('damage')) {
      discrepancyType = 'damaged';
    } else if (notes?.toLowerCase().includes('expire')) {
      discrepancyType = 'expired';
    }

    await this.dataSource.query(
      `
      INSERT INTO verification_discrepancies (
        tenant_id,
        stock_batch_id,
        po_id,
        discrepancy_type,
        expected_qty,
        actual_qty,
        variance_qty,
        notes,
        reported_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        tenantId,
        batchId,
        poId,
        discrepancyType,
        expectedQty,
        actualQty,
        varianceQty,
        notes,
        userId,
      ],
    );
  }
}
