// apps/api/src/stock/return-requests.controller.ts
import {
  Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const ALLOWED = ['owner', 'pharmacist'];

@Controller('return-requests')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReturnRequestsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── GET /return-requests ──────────────────────────────────────────────────
  @Get()
  async list(@Query() q: any, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const params: any[] = [tenantId];
    const where: string[] = [];
    if (q.status) { params.push(q.status); where.push(`rr.status = $${params.length}::return_request_status`); }
    const wc = where.length ? 'AND ' + where.join(' AND ') : '';
    return this.ds.query(
      `SELECT rr.*,
         COUNT(rri.id)::int AS item_count,
         COALESCE(SUM(rri.return_qty),0)::int AS total_units,
         COALESCE(SUM(rri.return_value),0)::numeric AS total_value
       FROM return_requests rr
       LEFT JOIN return_request_items rri ON rri.return_request_id = rr.id
       WHERE rr.tenant_id = $1 ${wc}
       GROUP BY rr.id
       ORDER BY rr.created_at DESC
       LIMIT 100`,
      params,
    );
  }

  // ── GET /return-requests/expiry-list ─────────────────────────────────────
  @Get('expiry-list')
  async expiryList(@Query() q: any, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const days = Number(q.days || 90);
    return this.ds.query(
      `SELECT
         sb.id, sb.batch_number, sb.expiry_date, sb.quantity,
         sb.purchase_price, sb.mrp, sb.sale_rate, sb.supplier_id,
         m.id AS medicine_id, m.brand_name, m.molecule, m.strength,
         m.schedule_class, m.gst_percent,
         s.name AS supplier_name,
         (sb.expiry_date - CURRENT_DATE)::int AS days_to_expiry,
         CASE
           WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
           WHEN sb.expiry_date < CURRENT_DATE + $2 * INTERVAL '1 day' THEN 'near_expiry'
           ELSE 'ok'
         END AS expiry_status
       FROM stock_batches sb
       JOIN medicines m ON m.id = sb.medicine_id
       LEFT JOIN suppliers s ON s.id = sb.supplier_id
       WHERE sb.tenant_id = $1
         AND sb.quantity > 0
         AND sb.is_active = true
         AND sb.expiry_date <= CURRENT_DATE + $2 * INTERVAL '1 day'
       ORDER BY sb.expiry_date ASC`,
      [tenantId, days],
    );
  }

  // ── GET /return-requests/supplier-credits ────────────────────────────────
  @Get('supplier-credits')
  async supplierCredits(@Query() q: any, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const params: any[] = [tenantId];
    let filter = '';
    if (q.supplier_id) { params.push(q.supplier_id); filter = `AND sc.supplier_id = $${params.length}`; }
    return this.ds.query(
      `SELECT sc.*,
         COALESCE(s.name, sc.supplier_name) AS supplier_name_resolved
       FROM supplier_credits sc
       LEFT JOIN suppliers s ON s.id = sc.supplier_id
       WHERE sc.tenant_id = $1 AND sc.status != 'fully_used' ${filter}
       ORDER BY sc.created_at DESC`,
      params,
    );
  }

  // ── GET /return-requests/:id ──────────────────────────────────────────────
  @Get(':id')
  async getOne(@Param('id') id: string, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const [rr] = await this.ds.query(
      `SELECT * FROM return_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!rr) throw new BadRequestException('Return request not found');
    const items = await this.ds.query(
      `SELECT rri.*, m.brand_name, m.molecule, m.strength, m.schedule_class
       FROM return_request_items rri
       JOIN medicines m ON m.id = rri.medicine_id
       WHERE rri.return_request_id = $1
       ORDER BY rri.created_at ASC`,
      [id],
    );
    return { ...rr, items };
  }

  // ── POST /return-requests ─────────────────────────────────────────────────
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const { tenant_id: tenantId, sub: userId, role, full_name } = req.user;
    if (!ALLOWED.includes(role)) throw new ForbiddenException();
    if (!body.items?.length) throw new BadRequestException('At least one item required');

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const [cnt] = await qr.query(
        `SELECT COUNT(*)::int AS c FROM return_requests WHERE tenant_id = $1`,
        [tenantId],
      );
      const seq = String(cnt.c + 1).padStart(4, '0');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rrNumber = `RR-${today}-${seq}`;

      const [rr] = await qr.query(
        `INSERT INTO return_requests
           (tenant_id, rr_number, supplier_id, supplier_name, supplier_phone,
            status, notes, created_by, created_by_name)
         VALUES ($1,$2,$3,$4,$5,'draft',$6,$7,$8)
         RETURNING *`,
        [tenantId, rrNumber,
         body.supplier_id || null, body.supplier_name || null, body.supplier_phone || null,
         body.notes || null, userId, full_name || 'Unknown'],
      );

      for (const item of body.items) {
        const [batch] = await qr.query(
          `SELECT sb.*, m.brand_name FROM stock_batches sb
           JOIN medicines m ON m.id = sb.medicine_id
           WHERE sb.id = $1 AND sb.tenant_id = $2`,
          [item.batch_id, tenantId],
        );
        if (!batch) continue;

        const returnQty = Math.min(Number(item.return_qty || 1), Number(batch.quantity));
        const returnValue = returnQty * Number(batch.purchase_price || 0);

        await qr.query(
          `INSERT INTO return_request_items
             (return_request_id, tenant_id, batch_id, medicine_id,
              medicine_name, batch_number, expiry_date,
              return_qty, purchase_price, mrp, return_value,
              return_reason, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [rr.id, tenantId, item.batch_id, batch.medicine_id,
           batch.brand_name, batch.batch_number, batch.expiry_date,
           returnQty, batch.purchase_price || 0, batch.mrp || 0, returnValue,
           item.return_reason || 'expired', item.notes || null],
        );
      }

      await qr.commitTransaction();
      return this.getOne(rr.id, req);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ── PATCH /return-requests/:id/status ────────────────────────────────────
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { tenant_id: tenantId, sub: userId, role, full_name } = req.user;
    if (!ALLOWED.includes(role)) throw new ForbiddenException();

    const [rr] = await this.ds.query(
      `SELECT * FROM return_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!rr) throw new BadRequestException('Return request not found');

    const newStatus = body.status;
    const validTransitions: Record<string, string[]> = {
      draft: ['sent', 'cancelled'],
      sent: ['cancelled'],
      confirmed: ['closed'],
    };

    if (!validTransitions[rr.status]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${rr.status} to ${newStatus}`);
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Mark as sent → deduct stock immediately
      if (newStatus === 'sent') {
        const items = await qr.query(
          `SELECT * FROM return_request_items WHERE return_request_id = $1 AND stock_reduced = false`,
          [id],
        );

        for (const item of items) {
          const [batch] = await qr.query(
            `SELECT * FROM stock_batches WHERE id = $1 FOR UPDATE`,
            [item.batch_id],
          );
          if (!batch) continue;

          const newQty = Math.max(0, Number(batch.quantity) - Number(item.return_qty));
          await qr.query(
            `UPDATE stock_batches SET quantity = $1, updated_at = NOW(),
             is_active = CASE WHEN $1 = 0 THEN false ELSE is_active END
             WHERE id = $2`,
            [newQty, item.batch_id],
          );

          await qr.query(
            `UPDATE return_request_items SET stock_reduced = true WHERE id = $1`,
            [item.id],
          );

          await qr.query(
            `INSERT INTO stock_adjustments
               (tenant_id, batch_id, medicine_id, adjustment_type,
                quantity_change, quantity_before, quantity_after,
                notes, performed_by, created_by)
             VALUES ($1,$2,$3,'supplier_return',$4,$5,$6,$7,$8,$9)`,
            [tenantId, item.batch_id, item.medicine_id,
             -item.return_qty, batch.quantity, newQty,
             `Return Request ${rr.rr_number} — ${rr.supplier_name || ''}`.trim(),
             userId, userId],
          );
        }

        await qr.query(
          `UPDATE return_requests SET status = 'sent'::return_request_status,
           sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id],
        );
      } else {
        await qr.query(
          `UPDATE return_requests SET status = $1::return_request_status,
           updated_at = NOW() WHERE id = $2`,
          [newStatus, id],
        );
      }

      await qr.commitTransaction();
      return this.getOne(id, req);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ── PATCH /return-requests/:id/settle ────────────────────────────────────
  @Patch(':id/settle')
  async settle(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { tenant_id: tenantId, sub: userId, role, full_name } = req.user;
    if (!ALLOWED.includes(role)) throw new ForbiddenException();

    const [rr] = await this.ds.query(
      `SELECT * FROM return_requests WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId],
    );
    if (!rr) throw new BadRequestException('Return request not found');
    if (rr.status !== 'sent') throw new BadRequestException('Can only settle a sent return request');

    const { settlement_type, settlement_amount, settlement_ref, settlement_date, settlement_notes } = body;
    if (!['credit_note', 'cash', 'upi'].includes(settlement_type)) {
      throw new BadRequestException('Invalid settlement type');
    }
    if (!settlement_amount || Number(settlement_amount) <= 0) {
      throw new BadRequestException('Settlement amount is required');
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      const amount = Number(settlement_amount);
      const sDate = settlement_date || new Date().toISOString().slice(0, 10);

      // Update return request
      await qr.query(
        `UPDATE return_requests SET
           status = 'confirmed'::return_request_status,
           confirmed_at = NOW(),
           settlement_type = $1,
           settlement_amount = $2,
           settlement_ref = $3,
           settlement_date = $4,
           settlement_notes = $5,
           credit_note_no = $6,
           credit_amount = $2,
           updated_at = NOW()
         WHERE id = $7`,
        [settlement_type, amount, settlement_ref || null,
         sDate, settlement_notes || null,
         settlement_type === 'credit_note' ? (settlement_ref || null) : null,
         id],
      );

      if (settlement_type === 'credit_note') {
        // Create supplier credit record
        await qr.query(
          `INSERT INTO supplier_credits
             (tenant_id, supplier_id, supplier_name, return_request_id,
              credit_note_no, credit_amount, used_amount,
              credit_date, status, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,0,$7,'active',$8,$9)`,
          [tenantId, rr.supplier_id || null, rr.supplier_name || null,
           id, settlement_ref || null, amount, sDate,
           settlement_notes || null, userId],
        );
      } else {
        // Cash or UPI — create income entry in expenses table
        await qr.query(
          `INSERT INTO expenses
             (tenant_id, expense_date, category, description, amount,
              payment_mode, reference_no, vendor_name, payment_type, created_by)
           VALUES ($1,$2,'Stock Return Income',$3,$4,$5,$6,$7,'income',$8)`,
          [tenantId, sDate,
           `Stock return from ${rr.supplier_name || 'supplier'} — ${rr.rr_number}`,
           amount,
           settlement_type === 'upi' ? 'UPI' : 'Cash',
           settlement_ref || null,
           rr.supplier_name || null,
           userId],
        );
      }

      await qr.commitTransaction();
      return this.getOne(id, req);
    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }

  // ── POST /return-requests/patient ───────────────────────────────────────
  @Post('patient')
  async createPatientReturn(@Body() body: any, @Req() req: any) {
    const { tenant_id: tenantId, sub: userId } = req.user;
    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      // Validate sale belongs to tenant
      const sales = await qr.query(
        `SELECT id, bill_number, patient_name FROM sales WHERE id = $1 AND tenant_id = $2`,
        [body.sale_id, tenantId]
      );
      if (!sales.length) throw new Error('Sale not found');

      // Generate return number
      const countRow = await qr.query(
        `SELECT COUNT(*) as cnt FROM patient_returns WHERE tenant_id = $1`, [tenantId]
      );
      const num = String(Number(countRow[0].cnt) + 1).padStart(4, '0');
      const returnNo = `PR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${num}`;

      // Create patient_return record
      const ret = await qr.query(
        `INSERT INTO patient_returns (tenant_id, return_number, sale_id, bill_number, patient_name, total_refund, created_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
        [tenantId, returnNo, body.sale_id, body.bill_no, body.patient_name || null,
         body.items.reduce((s: number, i: any) => s + Number(i.return_value || 0), 0), userId]
      );
      const returnId = ret[0].id;

      for (const item of body.items) {
        // Validate batch belongs to this sale
        const saleItem = await qr.query(
          `SELECT id, qty FROM sale_items WHERE id = $1 AND sale_id = $2`,
          [item.sale_item_id, body.sale_id]
        );
        if (!saleItem.length) throw new Error(`Item ${item.medicine_name} not found in this bill`);

        // Check already returned qty
        const alreadyReturned = await qr.query(
          `SELECT COALESCE(SUM(pri.return_qty), 0) as total
           FROM patient_return_items pri
           JOIN patient_returns pr ON pr.id = pri.return_id
           WHERE pri.sale_item_id = $1 AND pr.tenant_id = $2`,
          [item.sale_item_id, tenantId]
        );
        const maxReturnable = Number(saleItem[0].qty) - Number(alreadyReturned[0].total);
        if (item.return_qty > maxReturnable) {
          throw new Error(`Cannot return ${item.return_qty} of ${item.medicine_name} — only ${maxReturnable} returnable`);
        }

        // Insert return item
        await qr.query(
          `INSERT INTO patient_return_items (return_id, sale_item_id, medicine_id, medicine_name, batch_id, batch_number, return_qty, unit_price, return_value, reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [returnId, item.sale_item_id, item.medicine_id, item.medicine_name,
           item.batch_id, item.batch_number, item.return_qty,
           item.unit_price, item.return_value, item.reason]
        );

        // Restore stock
        if (item.batch_id) {
          await qr.query(
            `UPDATE stock_batches SET quantity = quantity + $1 WHERE id = $2 AND tenant_id = $3`,
            [item.return_qty, item.batch_id, tenantId]
          );
        }
      }

      await qr.commitTransaction();
      return { success: true, return_number: returnNo, return_id: returnId };
    } catch (e: any) {
      await qr.rollbackTransaction();
      throw new BadRequestException(e.message || 'Failed to process patient return');
    } finally {
      await qr.release();
    }
  }

  // ── PATCH /return-requests/:id ────────────────────────────────────────────
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { tenant_id: tenantId, role } = req.user;
    if (!ALLOWED.includes(role)) throw new ForbiddenException();
    await this.ds.query(
      `UPDATE return_requests
       SET supplier_id = COALESCE($1, supplier_id),
           supplier_name = COALESCE($2, supplier_name),
           supplier_phone = COALESCE($3, supplier_phone),
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6 AND status = 'draft'`,
      [body.supplier_id || null, body.supplier_name || null,
       body.supplier_phone || null, body.notes || null, id, tenantId],
    );
    return this.getOne(id, req);
  }
}
