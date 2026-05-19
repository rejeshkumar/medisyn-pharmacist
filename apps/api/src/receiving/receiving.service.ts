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
        sb.received_qty,
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

    // After verification, check if all batches for this PO are verified
    if (batchData.po_id) {
      await this.checkAndUpdatePOStatus(batchData.po_id, tenantId);
    }

    // After verification, check if all batches for this PO are verified
    if (batchData.po_id) {
      await this.checkAndUpdatePOStatus(batchData.po_id, tenantId);
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
            receiving_status = 'completed',
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
            // Create pharmacy_purchases entry
            const purchaseId = await this.dataSource.query(
              `
              INSERT INTO pharmacy_purchases (
                id, tenant_id, purchase_date, vendor_name, invoice_no,
                amount, total_amount, payment_mode, credit_period, 
                is_paid, paid_amount, pending_amount, payment_status,
                po_id, supplier_id, notes, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4,
                $5, $5, $6, $7,
                false, 0, $5, 'unpaid',
                $8, $9, $10, NOW(), NOW()
              )
              RETURNING id
              `,
              [
                tenantId,
                new Date().toISOString().split('T')[0], // purchase_date (today)
                po.supplier_name || 'Unknown Supplier',
                po.po_number, // Use PO number as invoice reference
                po.total_amount || 0,
                po.credit_days > 0 ? 'CREDIT' : 'CASH',
                po.credit_days ? `${po.credit_days}DAYS` : null,
                poId,
                po.supplier_id,
                `Auto-created from ${po.po_number} verification`
              ]
            );

            // Create upcoming_payment linked to the purchase
            await this.dataSource.query(
              `
              INSERT INTO upcoming_payments (
                id, tenant_id, payment_type, description, amount, 
                due_date, is_urgent, is_paid, source_type, source_id, created_at, updated_at
              ) VALUES (
                gen_random_uuid(), $1, 'purchase', $2, $3, 
                $4, false, false, 'pharmacy_purchase', $5, NOW(), NOW()
              )
              `,
              [
                tenantId,
                `Payment for ${po.po_number} - ${po.supplier_name || 'Supplier'}`,
                po.total_amount || 0,
                dueDate.toISOString().split('T')[0],
                purchaseId[0].id  // Link to pharmacy_purchases, not PO
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
}
