import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Res, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Response } from 'express';
import * as dayjs from 'dayjs';

const ALLOWED = ['owner', 'pharmacist'];

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProcurementController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ══════════════════════════════════════════════════════════
  // SUPPLIERS
  // ══════════════════════════════════════════════════════════

  @Get('suppliers')
  async listSuppliers(@Req() req: any) {
    return this.ds.query(
      `SELECT * FROM suppliers WHERE tenant_id = $1 AND is_active = true
       ORDER BY name ASC`,
      [req.user.tenant_id],
    );
  }

  @Post('suppliers')
  async createSupplier(@Body() body: any, @Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    const r = await this.ds.query(
      `INSERT INTO suppliers (tenant_id, name, phone, email, gst_number, address)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.tenant_id, body.name, body.phone||null,
       body.email||null, body.gst_number||null, body.address||null],
    );
    return r[0];
  }

  @Patch('suppliers/:id')
  async updateSupplier(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    await this.ds.query(
      `UPDATE suppliers SET name=$1, phone=$2, email=$3,
       gst_number=$4, address=$5 WHERE id=$6 AND tenant_id=$7`,
      [body.name, body.phone||null, body.email||null,
       body.gst_number||null, body.address||null, id, req.user.tenant_id],
    );
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // REORDER FLAGS
  // ══════════════════════════════════════════════════════════

  @Get('reorder-flags')
  async getReorderFlags(@Query('status') status: string, @Req() req: any) {
    const s = status || 'pending';
    return this.ds.query(
      `SELECT rf.*,
              m.brand_name, m.molecule, m.strength, m.dosage_form,
              m.gst_percent, m.hsn_code, m.manufacturer, m.rack_location,
              m.reorder_qty AS medicine_reorder_qty,
              sup.name AS supplier_name, sup.phone AS supplier_phone,
              COALESCE(sales.sold_30d, 0)::int         AS sold_30d,
              ROUND(COALESCE(sales.sold_30d, 0) / 30.0, 1) AS daily_rate,
              CASE
                WHEN COALESCE(sales.sold_30d, 0) = 0 THEN 999
                ELSE ROUND(rf.current_stock / (COALESCE(sales.sold_30d, 0) / 30.0))::int
              END                                      AS days_left,
              CASE
                WHEN rf.current_stock = 0               THEN 'OUT OF STOCK'
                WHEN COALESCE(sales.sold_30d, 0) = 0   THEN 'NO SALES'
                WHEN ROUND(rf.current_stock / (COALESCE(sales.sold_30d,0)/30.0)) < 3  THEN 'CRITICAL'
                WHEN ROUND(rf.current_stock / (COALESCE(sales.sold_30d,0)/30.0)) < 7  THEN 'WARNING'
                ELSE 'WATCH'
              END                                      AS urgency
       FROM reorder_flags rf
       JOIN medicines m ON m.id = rf.medicine_id
       LEFT JOIN suppliers sup ON sup.id = rf.preferred_supplier_id
       LEFT JOIN (
         SELECT si.medicine_id, SUM(si.qty)::int AS sold_30d
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.tenant_id = $1 AND s.is_voided = false
           AND s.created_at > NOW() - INTERVAL '30 days'
         GROUP BY si.medicine_id
       ) sales ON sales.medicine_id = rf.medicine_id
       WHERE rf.tenant_id = $1 AND rf.status = $2
       ORDER BY
         CASE WHEN rf.current_stock = 0 THEN 0 ELSE 1 END,
         COALESCE(sales.sold_30d, 0) DESC,
         rf.current_stock ASC`,
      [req.user.tenant_id, s],
    );
  }

  @Post('reorder-flags/refresh')
  async refreshReorderFlags(@Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    const tid = req.user.tenant_id;

    // Load reorder settings from tenant config
    const settingsRow = await this.ds.query(
      `SELECT settings FROM tenants WHERE id = $1`, [tid]
    );
    const cfg = settingsRow[0]?.settings || {};
    const coverDays     = cfg.reorder_cover_days     ?? 14;
    const reorderDays   = cfg.reorder_qty_days       ?? 7;
    const suggestedDays = cfg.suggested_qty_days     ?? 30;
    const fallbackMin   = cfg.fallback_min_stock     ?? 10;
    const fallbackSug   = cfg.fallback_suggested_qty ?? 20;

    await this.ds.query(
      `INSERT INTO reorder_flags (
         tenant_id, medicine_id, current_stock, reorder_qty,
         suggested_qty, status
       )
       SELECT
         m.tenant_id,
         m.id                                                        AS medicine_id,
         COALESCE(stock.total_qty, 0)::int                          AS current_stock,
         CASE
           WHEN COALESCE(sales.sold_30d, 0) > 0
           THEN CEIL(sales.sold_30d / 30.0 * $2)::int
           ELSE $4
         END                                                         AS reorder_qty,
         CASE
           WHEN COALESCE(sales.sold_30d, 0) > 0
           THEN CEIL(sales.sold_30d / 30.0 * $3)::int
           ELSE $5
         END                                                         AS suggested_qty,
         'pending'                                                   AS status
       FROM medicines m
       LEFT JOIN (
         SELECT medicine_id, SUM(quantity)::int AS total_qty
         FROM stock_batches
         WHERE tenant_id = $1 AND is_active = true
           AND quantity > 0 AND expiry_date > CURRENT_DATE
         GROUP BY medicine_id
       ) stock ON stock.medicine_id = m.id
       LEFT JOIN (
         SELECT si.medicine_id, SUM(si.qty)::int AS sold_30d
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE s.tenant_id = $1
           AND s.is_voided = false
           AND s.created_at > NOW() - INTERVAL '30 days'
         GROUP BY si.medicine_id
       ) sales ON sales.medicine_id = m.id
       WHERE m.tenant_id = $1
         AND m.is_active = true
         AND (
           COALESCE(stock.total_qty, 0) = 0
           OR (
             COALESCE(sales.sold_30d, 0) > 0
             AND COALESCE(stock.total_qty, 0) < (sales.sold_30d / 30.0 * $6)
           )
           OR (
             COALESCE(sales.sold_30d, 0) = 0
             AND COALESCE(stock.total_qty, 0) <= $4
           )
         )
       ON CONFLICT (tenant_id, medicine_id, status) DO UPDATE SET
         current_stock = EXCLUDED.current_stock,
         reorder_qty   = EXCLUDED.reorder_qty,
         suggested_qty = EXCLUDED.suggested_qty,
         updated_at    = NOW()`,
      [tid, reorderDays, suggestedDays, fallbackMin, fallbackSug, coverDays],
    );

    // Remove flags for medicines that are now healthy
    await this.ds.query(
      `DELETE FROM reorder_flags
       WHERE tenant_id = $1 AND status = 'pending'
         AND medicine_id NOT IN (
           SELECT m.id FROM medicines m
           LEFT JOIN (
             SELECT medicine_id, SUM(quantity)::int AS total_qty
             FROM stock_batches
             WHERE tenant_id = $1 AND is_active = true
               AND quantity > 0 AND expiry_date > CURRENT_DATE
             GROUP BY medicine_id
           ) stock ON stock.medicine_id = m.id
           LEFT JOIN (
             SELECT si.medicine_id, SUM(si.qty)::int AS sold_30d
             FROM sale_items si
             JOIN sales s ON s.id = si.sale_id
             WHERE s.tenant_id = $1 AND s.is_voided = false
               AND s.created_at > NOW() - INTERVAL '30 days'
             GROUP BY si.medicine_id
           ) sales ON sales.medicine_id = m.id
           WHERE m.tenant_id = $1 AND m.is_active = true
             AND (
               COALESCE(stock.total_qty, 0) = 0
               OR (COALESCE(sales.sold_30d, 0) > 0
                   AND COALESCE(stock.total_qty, 0) < (sales.sold_30d / 30.0 * 14))
               OR (COALESCE(sales.sold_30d, 0) = 0
                   AND COALESCE(stock.total_qty, 0) <= 10)
             )
         )`,
      [tid],
    );

    const flags = await this.ds.query(
      `SELECT COUNT(*)::int AS count FROM reorder_flags WHERE tenant_id=$1 AND status='pending'`,
      [tid],
    );
    return { pending_flags: flags[0].count };
  }

  @Patch('reorder-flags/:id/dismiss')
  async dismissFlag(@Param('id') id: string, @Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    await this.ds.query(
      `UPDATE reorder_flags SET status='dismissed', updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2`,
      [id, req.user.tenant_id],
    );
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // PURCHASE ORDERS
  // ══════════════════════════════════════════════════════════

  @Get('purchase-orders')
  async listPOs(
    @Query('status') status: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const params: any[] = [req.user.tenant_id];
    let where = '';
    if (status) { params.push(status); where = `AND po.status = $${params.length}`; }

    return this.ds.query(
      `SELECT po.*,
              s.name AS supplier_name_resolved,
              COUNT(poi.id)::int AS item_count,
              SUM(poi.ordered_qty)::int AS total_units
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
       WHERE po.tenant_id = $1 ${where}
       GROUP BY po.id, s.name
       ORDER BY po.created_at DESC
       LIMIT ${limit || 50}`,
      params,
    );
  }

  @Get('purchase-orders/:id')
  async getPO(@Param('id') id: string, @Req() req: any) {
    const [po] = await this.ds.query(
      `SELECT po.*, s.name AS supplier_name_resolved, s.phone, s.email, s.gst_number
       FROM purchase_orders po
       LEFT JOIN suppliers s ON s.id = po.supplier_id
       WHERE po.id = $1 AND po.tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    if (!po) throw new BadRequestException('PO not found');

    const items = await this.ds.query(
      `SELECT poi.*, m.brand_name, m.manufacturer, m.rack_location
       FROM purchase_order_items poi
       JOIN medicines m ON m.id = poi.medicine_id
       WHERE poi.po_id = $1
       ORDER BY poi.created_at ASC`,
      [id],
    );
    return { ...po, items };
  }

  @Post('purchase-orders')
  async createPO(@Body() body: any, @Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    if (!body.items?.length) throw new BadRequestException('At least one item required');

    const tenantId = req.user.tenant_id;
    const qr = this.ds.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    try {
      // Generate PO number
      const cnt = await qr.query(
        `SELECT COUNT(*)::int AS n FROM purchase_orders WHERE tenant_id=$1`,
        [tenantId],
      );
      const poNumber = `PO-${dayjs().format('YYYYMMDD')}-${String(Number(cnt[0].n) + 1).padStart(4,'0')}`;

      // Create PO
      const po = await qr.query(
        `INSERT INTO purchase_orders (
           tenant_id, po_number, supplier_id, supplier_name,
           supplier_phone, supplier_email, status, order_date,
           expected_date, notes, created_by
         ) VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,$9,$10,$11)
         RETURNING id, po_number`,
        [
          tenantId, poNumber,
          body.supplier_id || null,
          body.supplier_name || null,
          body.supplier_phone || null,
          body.supplier_email || null,
          body.order_date || dayjs().format('YYYY-MM-DD'),
          body.expected_date || null,
          body.notes || null,
          req.user.sub,
          req.user.full_name || 'Unknown',
        ],
      );

      let totalAmount = 0;

      // Create line items
      for (const item of body.items) {
        const med = await qr.query(
          `SELECT brand_name, molecule, strength, hsn_code, gst_percent
           FROM medicines WHERE id=$1`,
          [item.medicine_id],
        );
        if (!med[0]) continue;

        const lineTotal = (item.ordered_qty || 0) * (item.unit_price || 0);
        totalAmount += lineTotal;

        // Update preferred supplier on medicine for future reorder grouping
        if (body.supplier_id) {
          await qr.query(
            `UPDATE medicines SET preferred_supplier_id = $1 WHERE id = $2 AND tenant_id = $3`,
            [body.supplier_id, item.medicine_id, tenantId]
          );
        }

        await qr.query(
          `INSERT INTO purchase_order_items (
             tenant_id, po_id, medicine_id, medicine_name,
             molecule, strength, hsn_code, gst_percent,
             ordered_qty, unit_price, total_price,
             reorder_flag_id, is_manual, notes
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            tenantId, po[0].id, item.medicine_id,
            med[0].brand_name, med[0].molecule, med[0].strength,
            med[0].hsn_code, med[0].gst_percent,
            item.ordered_qty, item.unit_price || null, lineTotal || null,
            item.reorder_flag_id || null,
            item.is_manual || false,
            item.notes || null,
          ],
        );

        // Update reorder flag status
        if (item.reorder_flag_id) {
          await qr.query(
            `UPDATE reorder_flags SET status='in_po', po_id=$1, updated_at=NOW()
             WHERE id=$2 AND tenant_id=$3`,
            [po[0].id, item.reorder_flag_id, tenantId],
          );
        }
      }

      // Update total
      await qr.query(
        `UPDATE purchase_orders SET total_amount=$1 WHERE id=$2`,
        [totalAmount, po[0].id],
      );

      // ════════════════════════════════════════════════════════════
      // WALK-IN PURCHASE: Auto-receive and create financial entries
      // ════════════════════════════════════════════════════════════
      if (body.purchase_type === 'walkin') {
        // 1. Create verified stock batches immediately
        for (const item of body.items) {
          const batchNumber = `WI-${po[0].po_number}-${item.medicine_id.substring(0, 8)}`;
          
          await qr.query(
            `INSERT INTO stock_batches (
               id, tenant_id, medicine_id, batch_number, expiry_date,
               quantity, purchase_price, mrp, sale_rate,
               supplier_id, purchase_invoice_no, is_active,
               po_id, received_qty, verified_qty,
               verification_status, verified_by, verified_at,
               created_by, created_at, updated_at
             ) VALUES (
               gen_random_uuid(), $1, $2, $3, $4,
               $5, $6, $7, $8,
               $9, $10, true,
               $11, $5, $5,
               'verified', $12, NOW(),
               $12, NOW(), NOW()
             )`,
            [
              tenantId,                                                          // $1
              item.medicine_id,                                                  // $2
              batchNumber,                                                       // $3
              body.expected_date || dayjs().add(2, 'year').format('YYYY-MM-DD'), // $4
              item.ordered_qty || 1,                                             // $5 (quantity, received_qty, verified_qty)
              item.unit_price || 0,                                              // $6 purchase_price
              item.unit_price ? Math.round(item.unit_price * 1.2 * 100) / 100 : 0, // $7 mrp
              item.unit_price || 0,                                              // $8 sale_rate
              body.supplier_id || null,                                          // $9
              po[0].po_number,                                                   // $10 purchase_invoice_no
              po[0].id,                                                          // $11 po_id
              req.user.sub,                                                      // $12 verified_by, created_by
            ],
          );
        }

        // 2. Update PO status to received
        await qr.query(
          `UPDATE purchase_orders 
           SET status = 'received',
               receiving_status = 'complete',
               items_received_count = (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = $1),
               total_items_count = (SELECT COUNT(*) FROM purchase_order_items WHERE po_id = $1),
               updated_at = NOW()
           WHERE id = $1`,
          [po[0].id],
        );

        // 3. Create pharmacy_purchases entry (marked as PAID for cash walk-in)
        await qr.query(
          `INSERT INTO pharmacy_purchases (
             id, tenant_id, purchase_date, vendor_name, invoice_no,
             amount, payment_mode, is_paid, paid_date,
             created_by, created_at, updated_at,
             po_id, supplier_id, total_amount,
             paid_amount, payment_status
           ) VALUES (
             gen_random_uuid(), $1, $2, $3, $4,
             $5, 'cash', true, $2,
             $6, NOW(), NOW(),
             $7, $8, $5,
             $5, 'paid'
           )`,
          [
            tenantId,                                             // $1
            body.order_date || dayjs().format('YYYY-MM-DD'),      // $2 purchase_date, paid_date
            body.supplier_name || 'Walk-in Supplier',             // $3 vendor_name
            po[0].po_number,                                      // $4 invoice_no
            totalAmount,                                          // $5 amount, total_amount, paid_amount
            req.user.sub,                                         // $6 created_by
            po[0].id,                                             // $7 po_id
            body.supplier_id || null,                             // $8 supplier_id
          ],
        );

        // 4. No upcoming_payment needed - cash = paid immediately
      }

      await qr.commitTransaction();
      return { id: po[0].id, po_number: po[0].po_number, total_amount: totalAmount };
    } catch (e) {
      await qr.rollbackTransaction(); throw e;
    } finally { await qr.release(); }
  }

  @Patch('purchase-orders/:id/status')
  async updatePOStatus(
    @Param('id') id: string,
    @Body() body: { status: string; sent_via?: string },
    @Req() req: any,
  ) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    await this.ds.query(
      `UPDATE purchase_orders SET status=$1,
       sent_via=COALESCE($2, sent_via),
       sent_at=CASE WHEN $1='sent' THEN NOW() ELSE sent_at END,
       updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4`,
      [body.status, body.sent_via||null, id, req.user.tenant_id],
    );
    return { ok: true };
  }

  @Post('purchase-orders/:id/receive')
  async receivePO(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    const tenantId = req.user.tenant_id;
    const qr = this.ds.createQueryRunner();
    await qr.connect(); await qr.startTransaction();

    try {
      for (const item of body.items || []) {
        if (!item.received_qty || item.received_qty <= 0) continue;

        // Update received qty on PO item
        await qr.query(
          `UPDATE purchase_order_items SET received_qty = received_qty + $1
           WHERE id=$2 AND po_id=$3`,
          [item.received_qty, item.id, id],
        );

        // Add to stock_batches
        await qr.query(
          `INSERT INTO stock_batches (
             tenant_id, medicine_id, batch_number, expiry_date,
             quantity, purchase_price, sale_rate, mrp,
             purchase_invoice_no, supplier_id
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            tenantId, item.medicine_id,
            item.batch_number || `PO-${dayjs().format('YYYYMMDD')}`,
            item.expiry_date || dayjs().add(2, 'year').format('YYYY-MM-DD'),
            item.received_qty,
            item.unit_price || 0,
            item.sale_rate || item.unit_price || 0,
            item.mrp || item.unit_price || 0,
            body.invoice_number || null,
            body.supplier_id || null,
          ],
        );

        // Update last order info on reorder flag
        await qr.query(
          `UPDATE reorder_flags SET status='received', updated_at=NOW()
           WHERE po_id=$1 AND medicine_id=$2 AND tenant_id=$3`,
          [id, item.medicine_id, tenantId],
        );
      }

      // Check if fully received
      const pending = await qr.query(
        `SELECT COUNT(*) FROM purchase_order_items
         WHERE po_id=$1 AND received_qty < ordered_qty`,
        [id],
      );
      const newStatus = Number(pending[0].count) > 0 ? 'partially_received' : 'received';
      await qr.query(
        `UPDATE purchase_orders SET status=$1, updated_at=NOW() WHERE id=$2`,
        [newStatus, id],
      );

      await qr.commitTransaction();
      return { ok: true, status: newStatus };
    } catch (e) {
      await qr.rollbackTransaction(); throw e;
    } finally { await qr.release(); }
  }

  // ── Export PO as CSV (for email/WhatsApp attachment) ──────
  @Get('purchase-orders/:id/export')
  async exportPO(
    @Param('id') id: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const { items, ...po } = await this.getPO(id, req);
    const rows = [
      [`Purchase Order: ${po.po_number}`],
      [`Supplier: ${po.supplier_name || po.supplier_name_resolved || 'N/A'}`],
      [`Date: ${po.order_date}`, `Expected: ${po.expected_date || 'N/A'}`],
      [],
      ['S.No', 'Medicine', 'Molecule', 'Strength', 'HSN', 'GST%', 'Qty', 'Unit Price', 'Total'],
      ...items.map((item: any, i: number) => [
        i + 1,
        item.medicine_name,
        item.molecule || '',
        item.strength || '',
        item.hsn_code || '',
        item.gst_percent || 0,
        item.ordered_qty,
        item.unit_price || '',
        item.total_price || '',
      ]),
      [],
      [`Total Amount: ₹${po.total_amount || 0}`],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${po.po_number}.csv"`);
    res.send(csv);
  }
}
