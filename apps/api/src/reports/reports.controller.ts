import {
  Controller, Get, Post, Patch, Query, Body,
  Param, Req, Res, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Response } from 'express';
import * as dayjs from 'dayjs';

@Controller('reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Helpers ────────────────────────────────────────────────
  private dateRange(range: string, from?: string, to?: string) {
    const end   = to   ? dayjs(to).endOf('day')   : dayjs().endOf('day');
    let   start = from ? dayjs(from).startOf('day') : null;
    if (!start) {
      if (range === '7d')    start = dayjs().subtract(7,  'day').startOf('day');
      else if (range === '30d')  start = dayjs().subtract(30, 'day').startOf('day');
      else if (range === '90d')  start = dayjs().subtract(90, 'day').startOf('day');
      else if (range === 'mtd')  start = dayjs().startOf('month');
      else if (range === 'ytd')  start = dayjs().startOf('year');
      else                        start = dayjs().subtract(30, 'day').startOf('day');
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }

  private checkRole(user: any, allowed: string[]) {
    if (!allowed.includes(user.role)) throw new ForbiddenException();
  }

  // ── GET /reports/registry ──────────────────────────────────
  // ── GET /reports/dashboard ────────────────────────────────
  @Get('dashboard')
  async getDashboard(@Req() req: any) {
    const tenantId = req.user.tenant_id;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const d90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const [todaySales, todayCount, lowStock, nearExpiry, topMeds, dailySales, recentBills, consultationRevenue, vipRevenue] = await Promise.all([
      this.ds.query(
        `SELECT
           COALESCE(SUM(total_amount),0) AS total,
           COALESCE(SUM(CASE WHEN payment_mode='cash' THEN total_amount END),0) AS cash,
           COALESCE(SUM(CASE WHEN payment_mode='upi' THEN total_amount END),0) AS upi,
           COALESCE(SUM(CASE WHEN payment_mode='card' THEN total_amount END),0) AS card
         FROM sales
         WHERE tenant_id=$1 AND is_voided=false
           AND DATE(created_at + INTERVAL '5 hours 30 minutes')=CURRENT_DATE`,
        [tenantId]
      ),
      this.ds.query(
        `SELECT COUNT(*)::int AS cnt FROM sales
         WHERE tenant_id=$1 AND is_voided=false
           AND created_at BETWEEN $2 AND $3`,
        [tenantId, todayStart, todayEnd]
      ),
      this.ds.query(
        `SELECT COUNT(*)::int AS cnt FROM stock_batches
         WHERE tenant_id=$1 AND quantity<=10 AND quantity>0 AND is_active=true`,
        [tenantId]
      ),
      this.ds.query(
        `SELECT COUNT(*)::int AS cnt FROM stock_batches
         WHERE tenant_id=$1 AND expiry_date<=$2 AND expiry_date>NOW()
           AND quantity>0 AND is_active=true`,
        [tenantId, d90]
      ),
      this.ds.query(
        `SELECT si.medicine_name, SUM(si.qty)::int AS total_qty,
                SUM(si.item_total) AS total_revenue
         FROM sale_items si
         JOIN sales s ON s.id=si.sale_id
         WHERE s.tenant_id=$1 AND s.is_voided=false
         GROUP BY si.medicine_name
         ORDER BY total_qty DESC LIMIT 10`,
        [tenantId]
      ),
      this.ds.query(
        `SELECT
           TO_CHAR(DATE(created_at + INTERVAL '5 hours 30 minutes'), 'DD') AS day,
           COALESCE(SUM(total_amount),0)::float AS total,
           COUNT(*)::int AS bill_count
         FROM sales
         WHERE tenant_id=$1 AND is_voided=false
           AND DATE(created_at + INTERVAL '5 hours 30 minutes') >= DATE_TRUNC('month', CURRENT_DATE)
         GROUP BY DATE(created_at + INTERVAL '5 hours 30 minutes')
         ORDER BY DATE(created_at + INTERVAL '5 hours 30 minutes') ASC`,
        [tenantId]
      ),
      this.ds.query(
        `SELECT bill_number, customer_name, total_amount, payment_mode, created_at
         FROM sales
         WHERE tenant_id=$1 AND is_voided=false
         ORDER BY created_at DESC LIMIT 5`,
        [tenantId]
      ),
      // Consultation revenue from clinic_bills (today)
      this.ds.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total
         FROM clinic_bills
         WHERE tenant_id=$1
           AND status IN ('confirmed','paid')
           AND DATE(created_at + INTERVAL '5 hours 30 minutes')=CURRENT_DATE`,
        [tenantId]
      ),
      // VIP subscription revenue (all time + today)
      this.ds.query(
        `SELECT
           COALESCE(SUM(payment_amount),0) AS total_all_time,
           COALESCE(SUM(CASE WHEN DATE(registered_at + INTERVAL '5 hours 30 minutes')=CURRENT_DATE THEN payment_amount END),0) AS today,
           COUNT(*)::int AS total_enrollments,
           COUNT(CASE WHEN DATE(registered_at + INTERVAL '5 hours 30 minutes')=CURRENT_DATE THEN 1 END)::int AS today_enrollments
         FROM vip_registrations
         WHERE tenant_id=$1`,
        [tenantId]
      ),
    ]);

    const pharmacyRevenue  = parseFloat(todaySales[0]?.total || '0');
    const consultRevenue   = parseFloat(consultationRevenue[0]?.total || '0');
    const vipToday         = parseFloat(vipRevenue[0]?.today || '0');
    const totalRevenue     = pharmacyRevenue + consultRevenue + vipToday;

    return {
      // Legacy fields (keep for backward compat)
      today_sales:       totalRevenue,
      today_cash:        parseFloat(todaySales[0]?.cash || '0'),
      today_upi:         parseFloat(todaySales[0]?.upi  || '0'),
      today_bill_count:  todayCount[0]?.cnt || 0,
      low_stock_count:   lowStock[0]?.cnt || 0,
      near_expiry_count: nearExpiry[0]?.cnt || 0,
      top_medicines:     topMeds,
      daily_sales:       dailySales.map((d: any) => ({ day: d.day, total: parseFloat(d.total), bills: d.bill_count })),
      recent_bills:      recentBills,
      // Revenue breakdown
      revenue_breakdown: {
        total:        totalRevenue,
        pharmacy:     pharmacyRevenue,
        consultation: consultRevenue,
        lab:          0,  // placeholder — lab module coming soon
        vip:          vipToday,
      },
      // VIP subscription stats
      vip_stats: {
        today_revenue:      vipToday,
        alltime_revenue:    parseFloat(vipRevenue[0]?.total_all_time || '0'),
        total_enrollments:  vipRevenue[0]?.total_enrollments || 0,
        today_enrollments:  vipRevenue[0]?.today_enrollments || 0,
      },
    };
  }

  @Get('registry')
  async getRegistry(@Req() req: any) {
    const configs = await this.ds.query(
      `SELECT rc.*, rr.name, rr.description, rr.category,
              rr.default_cols, rr.all_cols, rr.params, rr.sort_order
       FROM report_configs rc
       JOIN report_registry rr ON rr.id = rc.report_id
       WHERE rc.tenant_id = $1
         AND rc.is_visible = true
         AND rr.is_active  = true
         AND rr.roles ? $2
       ORDER BY rr.sort_order ASC`,
      [req.user.tenant_id, req.user.role],
    );
    return configs;
  }

  // ── PATCH /reports/config/:report_id ──────────────────────
  @Patch('config/:report_id')
  async updateConfig(
    @Param('report_id') reportId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    if (req.user.role !== 'owner') throw new ForbiddenException();
    await this.ds.query(
      `INSERT INTO report_configs (tenant_id, report_id, is_visible, visible_cols, default_range, allowed_roles)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, report_id) DO UPDATE SET
         is_visible    = COALESCE($3, report_configs.is_visible),
         visible_cols  = COALESCE($4, report_configs.visible_cols),
         default_range = COALESCE($5, report_configs.default_range),
         allowed_roles = COALESCE($6, report_configs.allowed_roles),
         updated_at    = NOW()`,
      [
        req.user.tenant_id, reportId,
        body.is_visible ?? null,
        body.visible_cols ? JSON.stringify(body.visible_cols) : null,
        body.default_range ?? null,
        body.allowed_roles ? JSON.stringify(body.allowed_roles) : null,
      ],
    );
    return { ok: true };
  }

  // ── POST /reports/schedules ────────────────────────────────
  @Post('schedules')
  async saveSchedule(@Body() body: any, @Req() req: any) {
    if (req.user.role !== 'owner') throw new ForbiddenException();
    await this.ds.query(
      `INSERT INTO report_schedules (tenant_id, report_id, frequency, send_to_email, send_day, send_hour, params)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT DO NOTHING`,
      [req.user.tenant_id, body.report_id, body.frequency,
       body.email, body.send_day||null, body.send_hour||8,
       JSON.stringify(body.params||{})],
    );
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // REPORT QUERIES
  // ══════════════════════════════════════════════════════════

  // ── Sales summary ─────────────────────────────────────────
  @Get('sales-summary')
  async salesSummary(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const { start, end } = this.dateRange(q.range||'30d', q.from, q.to);
    const tid = req.user.tenant_id;
    const src = q.source || 'all'; // all | pharmacy | consultation | lab | vip
    const pmFilter = q.payment_mode ? `AND payment_mode = '${q.payment_mode}'` : '';

    // Build UNION query based on source filter
    const sourceParts: string[] = [];

    if (src === 'all' || src === 'pharmacy') {
      sourceParts.push(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS date,
          total_amount, discount_amount AS discount_amt,
          subtotal, payment_mode, 'pharmacy' AS source
        FROM sales
        WHERE tenant_id = '${tid}'
          AND is_voided = false
          AND created_at BETWEEN '${start}' AND '${end}'
          ${pmFilter}
      `);
    }

    if (src === 'all' || src === 'consultation') {
      sourceParts.push(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS date,
          total_amount, 0 AS discount_amt,
          subtotal, payment_mode::text, 'consultation' AS source
        FROM clinic_bills
        WHERE tenant_id = '${tid}'
          AND status IN ('confirmed','paid')
          AND created_at BETWEEN '${start}' AND '${end}'
          ${pmFilter}
      `);
    }

    if (src === 'all' || src === 'vip') {
      sourceParts.push(`
        SELECT
          DATE(registered_at AT TIME ZONE 'Asia/Kolkata') AS date,
          payment_amount AS total_amount, 0 AS discount_amt,
          payment_amount AS subtotal, payment_method AS payment_mode, 'vip' AS source
        FROM vip_registrations
        WHERE tenant_id = '${tid}'
          AND registered_at BETWEEN '${start}' AND '${end}'
          ${q.payment_mode ? `AND payment_method = '${q.payment_mode}'` : ''}
      `);
    }

    if (sourceParts.length === 0) {
      return { rows: [], totals: { total_bills: 0, total_revenue: 0, total_discount: 0, avg_bill: 0 }, period: { start, end } };
    }

    const unionSql = sourceParts.join(' UNION ALL ');

    const rows = await this.ds.query(`
      SELECT
        date,
        COUNT(*)::int                                                AS bill_count,
        ROUND(SUM(subtotal)::numeric, 2)                            AS gross_amount,
        ROUND(SUM(discount_amt)::numeric, 2)                        AS discount,
        ROUND(SUM(total_amount)::numeric, 2)                        AS net_amount,
        ROUND(SUM(CASE WHEN payment_mode='cash' THEN total_amount ELSE 0 END)::numeric,2) AS cash,
        ROUND(SUM(CASE WHEN payment_mode='card' THEN total_amount ELSE 0 END)::numeric,2) AS card,
        ROUND(SUM(CASE WHEN payment_mode='upi'  THEN total_amount ELSE 0 END)::numeric,2) AS upi,
        ROUND(AVG(total_amount)::numeric, 2)                        AS avg_bill,
        ROUND(SUM(CASE WHEN source='pharmacy'     THEN total_amount ELSE 0 END)::numeric,2) AS pharmacy_revenue,
        ROUND(SUM(CASE WHEN source='consultation' THEN total_amount ELSE 0 END)::numeric,2) AS consultation_revenue,
        ROUND(SUM(CASE WHEN source='vip'          THEN total_amount ELSE 0 END)::numeric,2) AS vip_revenue
      FROM (${unionSql}) AS combined
      GROUP BY date
      ORDER BY date DESC
    `);

    const totals = await this.ds.query(`
      SELECT
        COUNT(*)::int                              AS total_bills,
        ROUND(SUM(total_amount)::numeric,2)        AS total_revenue,
        ROUND(SUM(discount_amt)::numeric,2)        AS total_discount,
        ROUND(AVG(total_amount)::numeric,2)        AS avg_bill,
        ROUND(SUM(CASE WHEN source='pharmacy'     THEN total_amount ELSE 0 END)::numeric,2) AS pharmacy_revenue,
        ROUND(SUM(CASE WHEN source='consultation' THEN total_amount ELSE 0 END)::numeric,2) AS consultation_revenue,
        ROUND(SUM(CASE WHEN source='vip'          THEN total_amount ELSE 0 END)::numeric,2) AS vip_revenue
      FROM (${unionSql}) AS combined
    `);

    return { rows, totals: totals[0], period: { start, end } };
  }

  // ── Medicine-wise sales ────────────────────────────────────
  @Get('medicine-sales')
  async medicineSales(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const { start, end } = this.dateRange(q.range||'30d', q.from, q.to);
    const tid = req.user.tenant_id;
    const limit = Number(q.limit) || 50;
    const sortBy = q.sort_by === 'revenue' ? 'revenue DESC' : 'qty_sold DESC';

    return this.ds.query(`
      SELECT
        m.brand_name, m.molecule, m.strength,
        m.schedule_class, m.manufacturer,
        SUM(si.qty)::int                              AS qty_sold,
        ROUND(SUM(si.item_total)::numeric, 2)         AS revenue,
        COUNT(DISTINCT si.sale_id)::int               AS bill_count,
        ROUND(AVG(si.rate)::numeric, 2)               AS avg_rate,
        MAX(s.created_at)::date                       AS last_sold
      FROM sale_items si
      JOIN medicines m  ON m.id  = si.medicine_id
      JOIN sales     s  ON s.id  = si.sale_id
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        AND m.schedule_class::text IN ('H','H1','X','OTC')
      GROUP BY m.id, m.brand_name, m.molecule, m.strength, m.schedule_class, m.manufacturer
      ORDER BY ${sortBy}
      LIMIT $4`,
      [tid, start, end, limit],
    );
  }

  // ── Doctor-wise revenue ────────────────────────────────────
  @Get('doctor-revenue')
  async doctorRevenue(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner']);
    const { start, end } = this.dateRange(q.range||'30d', q.from, q.to);
    const tid = req.user.tenant_id;

    return this.ds.query(`
      SELECT
        COALESCE(s.doctor_name, 'Walk-in / No referral') AS doctor_name,
        COUNT(DISTINCT s.customer_name)::int              AS patient_count,
        COUNT(*)::int                                     AS bill_count,
        ROUND(SUM(s.total_amount)::numeric, 2)            AS revenue,
        ROUND(AVG(s.total_amount)::numeric, 2)            AS avg_bill
      FROM sales s
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        ${q.doctor ? `AND s.doctor_name ILIKE '%${q.doctor}%'` : ''}
      GROUP BY COALESCE(s.doctor_name, 'Walk-in / No referral')
      ORDER BY revenue DESC`,
      [tid, start, end],
    );
  }

  // ── Patient visit report ───────────────────────────────────
  @Get('patient-visits')
  async patientVisits(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const { start, end } = this.dateRange(q.range||'30d', q.from, q.to);
    const tid = req.user.tenant_id;

    const rows = await this.ds.query(`
      SELECT
        COALESCE(s.customer_name, 'Walk-in')             AS patient_name,
        COUNT(DISTINCT s.id)::int                        AS visit_count,
        MAX(s.created_at + INTERVAL '5 hours 30 minutes')::date AS last_visit,
        ROUND(SUM(s.total_amount)::numeric, 2)           AS total_spent,
        ROUND(AVG(s.total_amount)::numeric, 2)           AS avg_bill,
        COALESCE(s.doctor_name, '—')                     AS doctor_name
      FROM sales s
      WHERE s.tenant_id = $1
        AND s.is_voided = false
        AND s.created_at BETWEEN $2 AND $3
        ${q.doctor ? `AND s.doctor_name ILIKE '%${q.doctor}%'` : ''}
      GROUP BY
        s.customer_name,
        s.doctor_name
      ORDER BY total_spent DESC
      LIMIT 500`,
      [tid, start, end],
    );

    return { rows };
  }

  // ── Stock valuation ────────────────────────────────────────
  @Get('stock-valuation')
  async stockValuation(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const tid = req.user.tenant_id;

    const rows = await this.ds.query(`
      SELECT
        m.brand_name, m.molecule, m.strength,
        m.schedule_class, m.rack_location, m.manufacturer,
        COUNT(sb.id)::int                                         AS batches,
        SUM(sb.quantity)::int                                     AS total_qty,
        ROUND(SUM(sb.quantity * sb.purchase_price)::numeric, 2)  AS purchase_value,
        ROUND(SUM(sb.quantity * sb.mrp)::numeric, 2)             AS mrp_value,
        ROUND(SUM(sb.quantity * sb.sale_rate)::numeric, 2)       AS sale_value
      FROM medicines m
      JOIN stock_batches sb ON sb.medicine_id = m.id
      WHERE m.tenant_id  = $1
        AND sb.tenant_id = $1
        AND sb.quantity  > 0
        AND sb.is_active = true
        AND m.schedule_class::text IN ('H','H1','X','OTC')
        ${q.category ? `AND m.category ILIKE '%${q.category}%'` : ''}
      GROUP BY m.id, m.brand_name, m.molecule, m.strength,
               m.schedule_class, m.rack_location, m.manufacturer
      ORDER BY purchase_value DESC`,
      [tid],
    );

    const totals = await this.ds.query(`
      SELECT
        SUM(sb.quantity)::int                                        AS total_units,
        ROUND(SUM(sb.quantity * sb.purchase_price)::numeric, 2)     AS total_purchase_value,
        ROUND(SUM(sb.quantity * sb.mrp)::numeric, 2)                AS total_mrp_value,
        COUNT(DISTINCT m.id)::int                                    AS medicine_count
      FROM medicines m
      JOIN stock_batches sb ON sb.medicine_id = m.id
      WHERE m.tenant_id=$1 AND sb.tenant_id=$1 AND sb.quantity>0 AND sb.is_active=true`,
      [tid],
    );

    return { rows, totals: totals[0] };
  }

  // ── Expiry report ──────────────────────────────────────────
  @Get('expiry-report')
  async expiryReport(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const tid = req.user.tenant_id;
    const days = Number(q.within_days) || 90;

    return this.ds.query(`
      SELECT
        m.brand_name, m.molecule, m.strength, m.schedule_class, m.manufacturer,
        sb.batch_number, sb.expiry_date,
        (sb.expiry_date - CURRENT_DATE)::int AS days_left,
        sb.quantity,
        ROUND(sb.quantity * sb.purchase_price, 2) AS purchase_value,
        ROUND(sb.quantity * sb.mrp, 2)            AS mrp_value,
        sup.name                                   AS supplier
      FROM stock_batches sb
      JOIN medicines m    ON m.id  = sb.medicine_id
      LEFT JOIN suppliers sup ON sup.id = sb.supplier_id
      WHERE sb.tenant_id = $1
        AND sb.quantity  > 0
        AND sb.expiry_date <= CURRENT_DATE + INTERVAL '${days} days'
        AND sb.expiry_date >= CURRENT_DATE - INTERVAL '30 days'
        AND m.schedule_class::text IN ('H','H1','X','OTC')
      ORDER BY sb.expiry_date ASC`,
      [tid],
    );
  }


  // ── Low stock report ───────────────────────────────────────
  @Get('low-stock')
  async lowStock(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const tid = req.user.tenant_id;

    // Read velocity-based reorder settings from tenant config (same as procurement)
    const settingsRow = await this.ds.query(
      `SELECT settings FROM tenants WHERE id = $1`, [tid],
    );
    const cfg         = settingsRow[0]?.settings || {};
    const coverDays   = cfg.reorder_cover_days ?? 14;
    const fallbackMin = cfg.fallback_min_stock ?? 10;

    // Mirrors procurement.controller reorder logic exactly so counts match the dashboard.
    const rows = await this.ds.query(`
      SELECT
        m.brand_name,
        m.molecule,
        m.strength,
        m.schedule_class,
        sup.name                                                  AS supplier,
        COALESCE(stock.total_qty, 0)::int                         AS current_qty,
        CASE
          WHEN COALESCE(sales.sold_30d, 0) > 0
          THEN CEIL(sales.sold_30d / 30.0 * $2)::int
          ELSE $3
        END                                                       AS reorder_level,
        GREATEST(
          CASE
            WHEN COALESCE(sales.sold_30d, 0) > 0
            THEN CEIL(sales.sold_30d / 30.0 * $2)::int
            ELSE $3
          END - COALESCE(stock.total_qty, 0), 0
        )::int                                                    AS shortfall,
        ROUND(COALESCE(sales.sold_30d, 0) / 30.0, 1)              AS avg_daily_sales,
        CASE
          WHEN COALESCE(sales.sold_30d, 0) > 0
          THEN ROUND(COALESCE(stock.total_qty, 0) / (sales.sold_30d / 30.0), 0)
          ELSE NULL
        END                                                       AS days_of_stock
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
      LEFT JOIN LATERAL (
        SELECT sup2.name
        FROM stock_batches sb2
        LEFT JOIN suppliers sup2 ON sup2.id = sb2.supplier_id
        WHERE sb2.medicine_id = m.id AND sb2.tenant_id = $1
        ORDER BY sb2.created_at DESC NULLS LAST
        LIMIT 1
      ) sup ON true
      WHERE m.tenant_id = $1
        AND m.is_active = true
        AND (
          COALESCE(stock.total_qty, 0) = 0
          OR (
            COALESCE(sales.sold_30d, 0) > 0
            AND COALESCE(stock.total_qty, 0) < (sales.sold_30d / 30.0 * $2)
          )
          OR (
            COALESCE(sales.sold_30d, 0) = 0
            AND COALESCE(stock.total_qty, 0) <= $3
          )
        )
      ORDER BY
        (COALESCE(stock.total_qty, 0) = 0) DESC,
        days_of_stock ASC NULLS LAST,
        shortfall DESC
      LIMIT 1000`,
      [tid, coverDays, fallbackMin],
    );

    return { rows };
  }

  // ── Purchase order history ─────────────────────────────────
  @Get('purchase-history')
  async purchaseHistory(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const { start, end } = this.dateRange(q.range||'90d', q.from, q.to);
    const tid = req.user.tenant_id;

    return this.ds.query(`
      SELECT
        po.po_number, po.order_date, po.expected_date, po.status,
        COALESCE(s.name, po.supplier_name) AS supplier_name,
        po.supplier_phone,
        COUNT(poi.id)::int                 AS item_count,
        SUM(poi.ordered_qty)::int          AS total_units,
        ROUND(SUM(poi.total_price)::numeric, 2) AS total_amount,
        po.sent_via, po.created_by_name
      FROM purchase_orders po
      LEFT JOIN suppliers s     ON s.id  = po.supplier_id
      LEFT JOIN purchase_order_items poi ON poi.po_id = po.id
      WHERE po.tenant_id = $1
        AND po.created_at BETWEEN $2 AND $3
        ${q.status ? `AND po.status = '${q.status}'` : ''}
      GROUP BY po.id, s.name
      ORDER BY po.order_date DESC`,
      [tid, start, end],
    );
  }

  // ── GST report (GSTR-1 format) ────────────────────────────
  @Get('gst-report')
  async gstReport(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner']);
    const { start, end } = this.dateRange(q.range||'mtd', q.from, q.to);
    const tid = req.user.tenant_id;

    const rows = await this.ds.query(`
      SELECT
        COALESCE(m.hsn_code, 'N/A')              AS hsn_code,
        si.gst_percent,
        SUM(si.qty)::int                          AS qty_sold,
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100))::numeric, 2)  AS taxable_amount,
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100) * (si.gst_percent/100) / 2)::numeric, 2) AS cgst,
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100) * (si.gst_percent/100) / 2)::numeric, 2) AS sgst,
        0::numeric                                AS igst,
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100) * (si.gst_percent/100))::numeric, 2) AS total_tax,
        ROUND(SUM(si.item_total)::numeric, 2)     AS net_amount
      FROM sale_items si
      JOIN medicines m ON m.id = si.medicine_id
      JOIN sales     s ON s.id = si.sale_id
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
      GROUP BY m.hsn_code, si.gst_percent
      ORDER BY si.gst_percent, m.hsn_code`,
      [tid, start, end],
    );

    const totals = await this.ds.query(`
      SELECT
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100))::numeric, 2)  AS total_taxable,
        ROUND(SUM(si.item_total / (1 + si.gst_percent/100) * (si.gst_percent/100))::numeric, 2) AS total_tax,
        ROUND(SUM(si.item_total)::numeric, 2)                              AS total_with_tax
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE s.tenant_id=$1 AND s.created_at BETWEEN $2 AND $3`,
      [tid, start, end],
    );

    return { rows, totals: totals[0], period: { start, end } };
  }

  // ── Attendance & payroll summary ───────────────────────────
  @Get('attendance-payroll')
  async attendancePayroll(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner']);
    const { start, end } = this.dateRange(q.range||'mtd', q.from, q.to);
    const tid = req.user.tenant_id;

    return this.ds.query(`
      SELECT
        u.full_name AS staff_name,
        u.role,
        COUNT(CASE WHEN a.status = 'present' THEN 1 END)::int           AS present,
        COUNT(CASE WHEN a.status = 'half_day' THEN 1 END)::int          AS half_day,
        COUNT(CASE WHEN a.status = 'absent'  THEN 1 END)::int           AS absent,
        COUNT(CASE WHEN a.status = 'on_leave' THEN 1 END)::int          AS leave,
        COUNT(CASE WHEN a.status = 'lop'     THEN 1 END)::int           AS lop,
        COUNT(CASE WHEN a.check_in_time > (CURRENT_DATE + INTERVAL '9 hours') THEN 1 END)::int AS late_count,
        ROUND(COALESCE(SUM(
          EXTRACT(EPOCH FROM (a.check_out_time - a.check_in_time)) / 3600
        ), 0)::numeric, 1)                                               AS total_hours
      FROM users u
      LEFT JOIN staff_attendance a
        ON a.user_id = u.id
        AND a.date BETWEEN $2::date AND $3::date
        AND a.tenant_id = $1
      WHERE u.tenant_id = $1
        AND u.is_active  = true
        ${q.role ? `AND u.role = '${q.role}'` : ''}
      GROUP BY u.id, u.full_name, u.role
      ORDER BY u.full_name`,
      [tid, start, end],
    );
  }

  // ── Schedule H/H1/X dispensing log ────────────────────────
  @Get('schedule-log')
  async scheduleLog(@Query() q: any, @Req() req: any) {
    this.checkRole(req.user, ['owner','pharmacist']);
    const { start, end } = this.dateRange(q.range||'30d', q.from, q.to);
    const tid = req.user.tenant_id;

    return this.ds.query(`
      SELECT
        s.created_at::date                         AS date,
        s.bill_number,
        s.customer_name                            AS patient_name,
        s.doctor_name,
        s.doctor_reg_no,
        m.brand_name                               AS medicine,
        sb.batch_number,
        m.schedule_class,
        si.qty,
        u.full_name                                AS pharmacist
      FROM sale_items si
      JOIN sales     s  ON s.id  = si.sale_id
      JOIN medicines m  ON m.id  = si.medicine_id
      LEFT JOIN stock_batches sb ON sb.id = si.batch_id
      LEFT JOIN users u ON u.id = s.created_by::uuid
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        AND m.schedule_class::text IN ('H','H1','X')
      ORDER BY s.created_at DESC
      LIMIT 500`,
      [tid, start, end],
    );
  }

  // ── CSV export ─────────────────────────────────────────────
  @Get(':report_id/export')
  async exportCSV(
    @Param('report_id') reportId: string,
    @Query() q: any,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const reportMap: Record<string, (q: any, req: any) => Promise<any>> = {
      sales_summary:      (q, r) => this.salesSummary(q, r),
      medicine_sales:     (q, r) => this.medicineSales(q, r),
      doctor_revenue:     (q, r) => this.doctorRevenue(q, r),
      patient_visits:     (q, r) => this.patientVisits(q, r),
      stock_valuation:    (q, r) => this.stockValuation(q, r),
      low_stock:          (q, r) => this.lowStock(q, r),
      expiry_report:      (q, r) => this.expiryReport(q, r),
      purchase_history:   (q, r) => this.purchaseHistory(q, r),
      gst_report:         (q, r) => this.gstReport(q, r),
      attendance_payroll: (q, r) => this.attendancePayroll(q, r),
      schedule_log:       (q, r) => this.scheduleLog(q, r),
    };

    const fn = reportMap[reportId];
    if (!fn) { res.status(404).json({ message: 'Report not found' }); return; }

    const result = await fn({ ...q, format: 'csv' }, req);
    const rows   = Array.isArray(result) ? result : result.rows || [];

    if (!rows.length) { res.status(200).send('No data'); return; }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row: any) =>
        headers.map(h => {
          const val = row[h] ?? '';
          return typeof val === 'string' && val.includes(',')
            ? `"${val}"` : val;
        }).join(',')
      ),
    ].join('\n');

    const filename = `${reportId}_${dayjs().format('YYYY-MM-DD')}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }


  // ══════════════════════════════════════════════════════════
  // PRESCRIPTION REPORT (Print / PDF)
  // ══════════════════════════════════════════════════════════

  @Get('prescription/:consultationId')
  async getPrescriptionReport(
    @Param('consultationId') consultationId: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;

    // Clinic/tenant details (letterhead)
    const [clinic] = await this.ds.query(
      `SELECT name, slug, address, phone, email, logo_url, gstin, license_no,
              clinic_address, clinic_phone, clinic_email
       FROM tenants WHERE id = $1`,
      [tid],
    );

    // Consultation + patient + doctor
    const [consult] = await this.ds.query(
      `SELECT
         c.id, c.chief_complaint, c.diagnosis, c.examination_notes,
         c.follow_up_date, c.notes as doctor_notes, c.consultation_type,
         c.created_at as consultation_date,
         p.id as patient_id, p.full_name as patient_name, p.mobile as patient_mobile,
         p.date_of_birth, p.gender, p.blood_group, p.address as patient_address,
         u.full_name as doctor_name, u.qualification, u.registration_no, u.designation,
         q.token_number
       FROM consultations c
       JOIN queues q ON q.id = c.queue_id
       JOIN patients p ON p.id = q.patient_id
       JOIN users u ON u.id = q.doctor_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [consultationId, tid],
    );

    if (!consult) return { error: 'Consultation not found' };

    // Prescription + items
    const [prescription] = await this.ds.query(
      `SELECT id, prescription_no, notes, issued_at
       FROM prescriptions
       WHERE consultation_id = $1 AND tenant_id = $2 AND is_active = true
       ORDER BY issued_at DESC LIMIT 1`,
      [consultationId, tid],
    );

    let items = [];
    if (prescription) {
      items = await this.ds.query(
        `SELECT medicine_name, dosage, frequency, duration, quantity, instructions
         FROM prescription_items
         WHERE prescription_id = $1 AND tenant_id = $2 AND is_active = true
         ORDER BY created_at`,
        [prescription.id, tid],
      );
    }

    // Vitals
    const vitalsResult = await this.ds.query(
      `SELECT blood_pressure, pulse_rate, temperature, weight, height, spo2,
              blood_sugar, complaints
       FROM pre_checks
       WHERE queue_id = (SELECT queue_id FROM consultations WHERE id = $1)
       AND tenant_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [consultationId, tid],
    ).catch(() => []);
    const vitals = vitalsResult[0] || {};

    // Age from DOB
    let age = '';
    if (consult.date_of_birth) {
      const dob = new Date(consult.date_of_birth);
      const now = new Date();
      age = `${now.getFullYear() - dob.getFullYear()}Y`;
    }

    return {
      clinic: {
        name: clinic?.name || 'MediSyn Speciality Clinic',
        address: clinic?.clinic_address || clinic?.address || '',
        phone: clinic?.clinic_phone || clinic?.phone || '',
        email: clinic?.clinic_email || clinic?.email || '',
        logo_url: clinic?.logo_url || null,
        gstin: clinic?.gstin || '',
        license_no: clinic?.license_no || '',
      },
      patient: {
        id: consult.patient_id,
        name: consult.patient_name,
        mobile: consult.patient_mobile,
        age,
        gender: consult.gender,
        blood_group: consult.blood_group,
        address: consult.patient_address,
      },
      consultation: {
        id: consult.id,
        date: consult.consultation_date,
        token: consult.token_number,
        type: consult.consultation_type,
        chief_complaint: consult.chief_complaint,
        diagnosis: consult.diagnosis,
        examination: consult.examination_notes,
        notes: consult.doctor_notes,
        follow_up: consult.follow_up_date,
      },
      prescription: {
        id: prescription?.id,
        number: prescription?.prescription_no,
        notes: prescription?.notes,
        issued_at: prescription?.issued_at,
        items,
      },
      vitals,
      doctor: {
        name: consult.doctor_name,
        qualification: consult.qualification || '',
        registration_no: consult.registration_no || '',
        designation: consult.designation || '',
      },
    };
  }

  // List prescriptions (for receptionist to find & print)
  @Get('prescription-list')
  async listPrescriptions(
    @Query('patient_id') patientId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;
    let q = `SELECT
       c.id as consultation_id, c.diagnosis, c.chief_complaint,
       c.created_at as consultation_date,
       p.full_name as patient_name, p.mobile,
       u.full_name as doctor_name,
       pr.prescription_no, pr.id as prescription_id,
       (SELECT COUNT(*) FROM prescription_items pi WHERE pi.prescription_id = pr.id AND pi.is_active = true) as item_count
     FROM consultations c
     JOIN queues qq ON qq.id = c.queue_id
     JOIN patients p ON p.id = qq.patient_id
     JOIN users u ON u.id = qq.doctor_id
     LEFT JOIN prescriptions pr ON pr.consultation_id = c.id AND pr.is_active = true
     WHERE c.tenant_id = $1`;
    const params: any[] = [tid];

    if (patientId) {
      q += ` AND qq.patient_id = $${params.length + 1}`;
      params.push(patientId);
    }
    if (from) {
      q += ` AND (c.created_at + INTERVAL '5 hours 30 minutes')::date >= $${params.length + 1}`;
      params.push(from);
    }
    if (to) {
      q += ` AND (c.created_at + INTERVAL '5 hours 30 minutes')::date <= $${params.length + 1}`;
      params.push(to);
    }

    q += ` ORDER BY c.created_at DESC LIMIT 50`;
    return this.ds.query(q, params);
  }

  // Update doctor profile (qualification, reg no)
  @Patch('doctor-profile')
  async updateDoctorProfile(@Body() body: any, @Req() req: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const f of ['qualification', 'registration_no', 'designation']) {
      if (body[f] !== undefined) {
        fields.push(`${f} = $${idx}`);
        params.push(body[f]);
        idx++;
      }
    }
    if (fields.length === 0) return { message: 'Nothing to update' };
    fields.push(`updated_at = NOW()`);
    params.push(req.user.sub);
    await this.ds.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx}`,
      params,
    );
    return { success: true };
  }


  @Get('export/near-expiry')
  async exportNearExpiry(
    @Query('days') days: number,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenant_id;
    const d = days ? Number(days) : 90;

    const rows = await this.ds.query(
      `SELECT
         m.brand_name,
         sb.batch_number AS batch_no,
         sb.expiry_date,
         sb.quantity AS available_qty,
         sb.purchase_price,
         sb.mrp,
         m.rack_location
       FROM stock_batches sb
       JOIN medicines m ON m.id = sb.medicine_id
       WHERE sb.tenant_id = $1
         AND sb.quantity > 0
         AND sb.is_active = true
         AND sb.expiry_date <= CURRENT_DATE + INTERVAL '1 day' * $2
       ORDER BY sb.expiry_date ASC`,
      [tenantId, d],
    );

    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Near Expiry');

    sheet.columns = [
      { header: 'Medicine', key: 'brand_name', width: 35 },
      { header: 'Batch No', key: 'batch_no', width: 18 },
      { header: 'Expiry Date', key: 'expiry_date', width: 15 },
      { header: 'Qty', key: 'available_qty', width: 10 },
      { header: 'Purchase Price', key: 'purchase_price', width: 15 },
      { header: 'MRP', key: 'mrp', width: 12 },
      { header: 'Rack', key: 'rack_location', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: 'FF00475A' },
    };

    for (const row of rows) {
      const r = sheet.addRow({
        brand_name: row.brand_name,
        batch_no: row.batch_no,
        expiry_date: row.expiry_date
          ? new Date(row.expiry_date).toLocaleDateString('en-IN')
          : '-',
        available_qty: Number(row.available_qty),
        purchase_price: Number(row.purchase_price || 0).toFixed(2),
        mrp: Number(row.mrp || 0).toFixed(2),
        rack_location: row.rack_location || '-',
      });

      if (new Date(row.expiry_date) < new Date()) {
        r.fill = {
          type: 'pattern', pattern: 'solid',
          fgColor: { argb: 'FFFEE2E2' },
        };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=expiry-report-${d}days.xlsx`,
    );
    res.send(Buffer.from(buffer));
  }

}
