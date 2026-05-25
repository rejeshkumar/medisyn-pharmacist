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
         COUNT(rri.id)::int AS items_count,
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
      // Generate RR number
      const [cnt] = await qr.query(
        `SELECT COUNT(*)::int AS c FROM return_requests WHERE tenant_id = $1`,
        [tenantId],
      );
      const seq = String(cnt.c + 1).padStart(4, '0');
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const rrNumber = `RR-${today}-${seq}`;

      // Create return request
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

      // Create items
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
      sent: ['confirmed', 'cancelled'],
      confirmed: ['closed'],
    };

    if (!validTransitions[rr.status]?.includes(newStatus)) {
      throw new BadRequestException(`Cannot transition from ${rr.status} to ${newStatus}`);
    }

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // If confirming — reduce stock for all items
      if (newStatus === 'confirmed') {
        const items = await qr.query(
          `SELECT * FROM return_request_items WHERE return_request_id = $1 AND stock_reduced = false`,
          [id],
        );

        for (const item of items) {
          // Lock and reduce batch quantity
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

          // Mark item stock reduced
          await qr.query(
            `UPDATE return_request_items SET stock_reduced = true WHERE id = $1`,
            [item.id],
          );

          // Stock adjustment audit log
          await qr.query(
            `INSERT INTO stock_adjustments
               (tenant_id, batch_id, medicine_id, adjustment_type, direction,
                qty_adjusted, qty_before, qty_after, reason,
                distributor_name, distributor_ref,
                schedule_class, requires_compliance, compliance_noted,
                adjusted_by, adjusted_by_name, notes)
             VALUES ($1,$2,$3,'return_to_distributor','decrease',$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14)`,
            [tenantId, item.batch_id, item.medicine_id,
             item.return_qty, batch.quantity, newQty,
             `Return Request ${rr.rr_number}`,
             rr.supplier_name || '', body.credit_note_no || '',
             batch.schedule_class || 'OTC',
             ['H','H1','X'].includes(batch.schedule_class || ''),
             userId, full_name || 'Unknown',
             item.notes || null],
          );
        }

        // Create finance credit entry (supplier owes us)
        const [totals] = await qr.query(
          `SELECT COALESCE(SUM(return_value),0) AS total FROM return_request_items
           WHERE return_request_id = $1`,
          [id],
        );
        const creditAmount = Number(totals.total) || 0;

        if (creditAmount > 0) {
          await qr.query(
            `INSERT INTO upcoming_payments
               (tenant_id, amount, due_date,
                payment_type, source_type, source_id, description, is_paid, created_by)
             VALUES ($1,$2,NOW() + INTERVAL '30 days','receivable','return_request',$3,$4,false,$5)
             ON CONFLICT DO NOTHING`,
            [tenantId, creditAmount, id,
             'Credit from ' + (rr.supplier_name || 'supplier') + ' — ' + rr.rr_number,
             userId],
          );
        }

        await qr.query(
          `UPDATE return_requests
           SET status = $1, confirmed_at = NOW(),
               credit_note_no = $2, credit_amount = $3, updated_at = NOW()
           WHERE id = $4`,
          [newStatus, body.credit_note_no || null, creditAmount, id],
        );
      } else {
        // Simple status update for sent/cancelled/closed
        await qr.query(
          `UPDATE return_requests
           SET status = $1::return_request_status,
               sent_at = CASE WHEN $1 = 'sent' THEN NOW() ELSE sent_at END,
               updated_at = NOW()
           WHERE id = $2`,
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
