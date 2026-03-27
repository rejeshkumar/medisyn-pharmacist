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
              s.name AS supplier_name, s.phone AS supplier_phone
       FROM reorder_flags rf
       JOIN medicines m ON m.id = rf.medicine_id
       LEFT JOIN suppliers s ON s.id = rf.preferred_supplier_id
       WHERE rf.tenant_id = $1 AND rf.status = $2
       ORDER BY rf.current_stock ASC, rf.flagged_at DESC`,
      [req.user.tenant_id, s],
    );
  }

  @Post('reorder-flags/refresh')
  async refreshReorderFlags(@Req() req: any) {
    // Manually trigger reorder check for all medicines
    if (!ALLOWED.includes(req.user.role)) throw new ForbiddenException();
    const medicines = await this.ds.query(
      `SELECT id FROM medicines WHERE tenant_id = $1 AND reorder_qty > 0 AND is_active = true`,
      [req.user.tenant_id],
    );
    let flagged = 0;
    for (const m of medicines) {
      await this.ds.query(
        `SELECT check_reorder_after_sale($1, $2)`,
        [req.user.tenant_id, m.id],
      );
      flagged++;
    }
    // Return fresh list
    const flags = await this.ds.query(
      `SELECT COUNT(*) FROM reorder_flags WHERE tenant_id=$1 AND status='pending'`,
      [req.user.tenant_id],
    );
    return { checked: flagged, pending_flags: Number(flags[0].count) };
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
           expected_date, notes, created_by, created_by_name
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
