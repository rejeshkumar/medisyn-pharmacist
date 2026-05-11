// ============================================================
// apps/api/src/inventory-classification/inventory-classification.controller.ts
// Inventory Classification Engine — ALL thresholds configurable
// ============================================================

import {
  Controller, Get, Post, Patch, Query, Body, Param,
  Req, UseGuards, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const ALLOWED_ROLES = ['owner', 'office_manager', 'pharmacist'];

@Controller('inventory-classification')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InventoryClassificationController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  private checkRole(user: any) {
    if (!ALLOWED_ROLES.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  /** Parse all filter params from query string with defaults */
  private parseFilters(q: any) {
    return {
      analysisDays:      Math.max(1, parseInt(q.analysis_days)       || 90),
      deadThresholdDays: Math.max(1, parseInt(q.dead_threshold_days) || 90),
      fastThreshold:     Math.max(0, parseFloat(q.fast_threshold)    || 0.5),
      fastStockDays:     Math.max(1, parseInt(q.fast_stock_days)     || 14),
      slowStockDays:     Math.max(1, parseInt(q.slow_stock_days)     || 7),
      fastCycleDays:     Math.max(1, parseInt(q.fast_cycle_days)     || 10),
      slowCycleDays:     Math.max(1, parseInt(q.slow_cycle_days)     || 30),
    };
  }

  /** Call the classification SQL function with all params */
  private async classify(tenantId: string, q: any) {
    const f = this.parseFilters(q);
    return this.ds.query(
      `SELECT * FROM get_inventory_classification($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        tenantId, f.analysisDays, f.deadThresholdDays, f.fastThreshold,
        f.fastStockDays, f.slowStockDays, f.fastCycleDays, f.slowCycleDays,
      ],
    );
  }

  // ── Summary ────────────────────────────────────────────────
  @Get('summary')
  async getSummary(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    const f = this.parseFilters(q);
    const rows = await this.ds.query(
      `SELECT * FROM get_inventory_classification_summary($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        req.user.tenant_id, f.analysisDays, f.deadThresholdDays, f.fastThreshold,
        f.fastStockDays, f.slowStockDays, f.fastCycleDays, f.slowCycleDays,
      ],
    );
    // Also return current filter values so UI can display them
    return { filters: f, data: rows };
  }

  // ── Full classified list ───────────────────────────────────
  @Get('list')
  async getClassifiedList(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    const lim = Math.min(parseInt(q.limit) || 100, 500);
    const off = parseInt(q.offset) || 0;

    let rows = await this.classify(req.user.tenant_id, q);

    // Filter by category
    if (q.category && ['fast', 'slow', 'dead'].includes(q.category)) {
      rows = rows.filter((r: any) => r.category === q.category);
    }

    // Search
    if (q.search) {
      const s = q.search.toLowerCase();
      rows = rows.filter((r: any) =>
        (r.brand_name || '').toLowerCase().includes(s) ||
        (r.molecule || '').toLowerCase().includes(s) ||
        (r.manufacturer || '').toLowerCase().includes(s)
      );
    }

    const total = rows.length;
    return { total, filters: this.parseFilters(q), data: rows.slice(off, off + lim) };
  }

  // ── Fast Moving ────────────────────────────────────────────
  @Get('fast-moving')
  async fastMoving(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    const f = this.parseFilters(q);
    const rows = await this.classify(req.user.tenant_id, q);

    const fast = rows
      .filter((r: any) => r.category === 'fast')
      .map((r: any) => ({
        ...r,
        purchase_cycle_days: f.fastCycleDays,
        target_stock_days: f.fastStockDays,
        is_urgent: Number(r.total_stock) <= Number(r.reorder_point),
        days_until_reorder: Math.max(
          Math.floor(
            (Number(r.total_stock) - Number(r.reorder_point))
            / Math.max(Number(r.avg_daily_sales), 0.01)
          ), 0),
      }));

    return {
      filters: f,
      summary: {
        total_items: fast.length,
        urgent_items: fast.filter((r: any) => r.is_urgent).length,
        total_purchase_value: fast.reduce((s: number, r: any) => s + Number(r.purchase_value || 0), 0).toFixed(2),
      },
      data: fast,
    };
  }

  // ── Slow Moving ────────────────────────────────────────────
  @Get('slow-moving')
  async slowMoving(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    const f = this.parseFilters(q);
    const rows = await this.classify(req.user.tenant_id, q);

    const slow = rows
      .filter((r: any) => r.category === 'slow')
      .map((r: any) => ({
        ...r,
        purchase_cycle_days: f.slowCycleDays,
        target_stock_days: f.slowStockDays,
        capital_locked: Number(r.excess_stock) > 0
          ? (Number(r.excess_stock) * (Number(r.purchase_value) / Math.max(Number(r.total_stock), 1))).toFixed(2)
          : '0.00',
      }));

    slow.sort((a: any, b: any) => Number(b.capital_locked) - Number(a.capital_locked));

    return {
      filters: f,
      summary: {
        total_items: slow.length,
        total_stock_value: slow.reduce((s: number, r: any) => s + Number(r.purchase_value || 0), 0).toFixed(2),
        total_capital_locked: slow.reduce((s: number, r: any) => s + Number(r.capital_locked || 0), 0).toFixed(2),
      },
      data: slow,
    };
  }

  // ── Dead Stock ─────────────────────────────────────────────
  @Get('dead-stock')
  async deadStock(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    const f = this.parseFilters(q);
    const rows = await this.classify(req.user.tenant_id, q);

    const dead = rows
      .filter((r: any) => r.category === 'dead')
      .map((r: any) => ({
        ...r,
        recoverable_value: Number(r.purchase_value || 0).toFixed(2),
        expiring_soon: r.earliest_expiry
          ? new Date(r.earliest_expiry) <= new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
          : false,
        is_expired: r.earliest_expiry
          ? new Date(r.earliest_expiry) <= new Date()
          : false,
      }));

    dead.sort((a: any, b: any) => {
      if (a.is_expired && !b.is_expired) return -1;
      if (!a.is_expired && b.is_expired) return 1;
      return Number(b.recoverable_value) - Number(a.recoverable_value);
    });

    // Existing return requests
    const returns = await this.ds.query(
      `SELECT medicine_id, status, credit_note_number, credit_note_amount
       FROM dead_stock_returns
       WHERE tenant_id = $1 AND status != 'rejected'
       ORDER BY created_at DESC`,
      [req.user.tenant_id],
    );
    const returnMap: Record<string, any> = {};
    for (const r of returns) {
      if (!returnMap[r.medicine_id]) returnMap[r.medicine_id] = r;
    }

    const enriched = dead.map((d: any) => ({
      ...d,
      return_status: returnMap[d.medicine_id]?.status || null,
      credit_note: returnMap[d.medicine_id]?.credit_note_number || null,
    }));

    return {
      filters: f,
      summary: {
        total_items: dead.length,
        total_dead_value: dead.reduce((s: number, r: any) => s + Number(r.recoverable_value || 0), 0).toFixed(2),
        expired_items: dead.filter((r: any) => r.is_expired).length,
        expiring_soon_items: dead.filter((r: any) => r.expiring_soon && !r.is_expired).length,
        items_with_returns: Object.keys(returnMap).length,
      },
      data: enriched,
    };
  }

  // ── Create return request ──────────────────────────────────
  @Post('dead-stock-return')
  async createReturn(@Body() body: any, @Req() req: any) {
    this.checkRole(req.user);
    if (!['owner', 'office_manager'].includes(req.user.role)) {
      throw new ForbiddenException('Only owner/office manager can create return requests');
    }
    const { medicine_id, supplier_id, batch_id, quantity, purchase_price, notes } = body;
    if (!medicine_id || !quantity) {
      throw new BadRequestException('medicine_id and quantity are required');
    }
    const result = await this.ds.query(
      `INSERT INTO dead_stock_returns
        (tenant_id, medicine_id, supplier_id, batch_id, quantity, purchase_price, total_value, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.tenant_id, medicine_id, supplier_id || null, batch_id || null,
       quantity, purchase_price || 0, (quantity * (purchase_price || 0)).toFixed(2),
       notes || null, req.user.id],
    );
    return result[0];
  }

  // ── Update return status ───────────────────────────────────
  @Patch('dead-stock-return/:id')
  async updateReturn(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    this.checkRole(req.user);
    if (!['owner', 'office_manager'].includes(req.user.role)) {
      throw new ForbiddenException('Only owner/office manager can update returns');
    }
    const { status, credit_note_number, credit_note_amount, credit_note_date, notes } = body;
    if (status && !['pending','returned','credit_received','rejected'].includes(status)) {
      throw new BadRequestException('Invalid status');
    }
    await this.ds.query(
      `UPDATE dead_stock_returns SET
        status=COALESCE($1,status), credit_note_number=COALESCE($2,credit_note_number),
        credit_note_amount=COALESCE($3,credit_note_amount), credit_note_date=COALESCE($4,credit_note_date),
        notes=COALESCE($5,notes), updated_at=NOW()
       WHERE id=$6 AND tenant_id=$7`,
      [status||null, credit_note_number||null, credit_note_amount||null,
       credit_note_date||null, notes||null, id, req.user.tenant_id],
    );
    if (status === 'credit_received') {
      const ret = await this.ds.query(`SELECT batch_id, quantity FROM dead_stock_returns WHERE id=$1`, [id]);
      if (ret[0]?.batch_id) {
        await this.ds.query(
          `UPDATE stock_batches SET quantity=GREATEST(quantity-$1,0), updated_at=NOW()
           WHERE id=$2 AND tenant_id=$3`,
          [ret[0].quantity, ret[0].batch_id, req.user.tenant_id],
        );
      }
    }
    return { ok: true };
  }

  // ── List returns ───────────────────────────────────────────
  @Get('dead-stock-returns')
  async listReturns(@Query('status') status: string, @Req() req: any) {
    this.checkRole(req.user);
    const sf = status ? `AND dsr.status = '${status}'` : '';
    return this.ds.query(
      `SELECT dsr.*, m.brand_name, m.molecule, m.strength, s.name AS supplier_name
       FROM dead_stock_returns dsr
       JOIN medicines m ON m.id = dsr.medicine_id
       LEFT JOIN suppliers s ON s.id = dsr.supplier_id
       WHERE dsr.tenant_id = $1 ${sf}
       ORDER BY dsr.created_at DESC`,
      [req.user.tenant_id],
    );
  }

  // ── CSV Export ─────────────────────────────────────────────
  @Get('export')
  async exportCSV(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user);
    let rows = await this.classify(req.user.tenant_id, q);
    if (q.category && ['fast','slow','dead'].includes(q.category)) {
      rows = rows.filter((r: any) => r.category === q.category);
    }
    const headers = [
      'Brand Name','Molecule','Strength','Manufacturer','Rack','Category',
      'Total Stock','Avg Daily Sales','Days of Stock','Purchase Value','MRP Value',
      'Recommended Stock','Excess Stock','Next Order Qty','Last Sale Date','Days Since Sale','Supplier',
    ];
    const csvRows = rows.map((r: any) => [
      r.brand_name, r.molecule, r.strength, r.manufacturer, r.rack_location,
      r.category, r.total_stock, r.avg_daily_sales, r.days_of_stock,
      r.purchase_value, r.mrp_value, r.recommended_stock, r.excess_stock,
      r.next_order_qty, r.last_sale_date, r.days_since_last_sale, r.supplier_name,
    ].map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(','));
    return {
      filename: `inventory-classification-${q.category||'all'}-${new Date().toISOString().split('T')[0]}.csv`,
      content: [headers.join(','), ...csvRows].join('\n'),
    };
  }
}
