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

    if (verified_qty + rejectedQty !== receivedQty) {
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

    return {
      success: true,
      batch_id,
      verification_status: verificationStatus,
      verified_qty,
      rejected_qty,
      message: `Batch verified: ${verified_qty} units accepted, ${rejectedQty} rejected`,
    };
  }

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
