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

    const [todaySales, todayCount, lowStock, nearExpiry, topMeds] = await Promise.all([
      this.ds.query(
        `SELECT COALESCE(SUM(total_amount),0) AS total FROM sales
         WHERE tenant_id=$1 AND is_voided=false
           AND created_at BETWEEN $2 AND $3`,
        [tenantId, todayStart, todayEnd]
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
    ]);

    return {
      today_sales:       parseFloat(todaySales[0]?.total || '0'),
      today_bill_count:  todayCount[0]?.cnt || 0,
      low_stock_count:   lowStock[0]?.cnt || 0,
      near_expiry_count: nearExpiry[0]?.cnt || 0,
      top_medicines:     topMeds,
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

    const rows = await this.ds.query(`
      SELECT
        DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') AS date,
        COUNT(*)::int                                   AS bill_count,
        ROUND(SUM(s.subtotal)::numeric, 2)             AS gross_amount,
        ROUND(SUM(s.discount_amount)::numeric, 2)      AS discount,
        ROUND(SUM(s.total_amount)::numeric, 2)         AS net_amount,
        ROUND(SUM(CASE WHEN s.payment_mode='cash' THEN s.total_amount ELSE 0 END)::numeric,2) AS cash,
        ROUND(SUM(CASE WHEN s.payment_mode='card' THEN s.total_amount ELSE 0 END)::numeric,2) AS card,
        ROUND(SUM(CASE WHEN s.payment_mode='upi'  THEN s.total_amount ELSE 0 END)::numeric,2) AS upi,
        ROUND(AVG(s.total_amount)::numeric, 2)         AS avg_bill,
        COUNT(DISTINCT s.customer_name)::int           AS patient_count
      FROM sales s
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
        ${q.payment_mode ? `AND s.payment_mode = '${q.payment_mode}'` : ''}
      GROUP BY DATE(s.created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date DESC`,
      [tid, start, end],
    );

    const totals = await this.ds.query(`
      SELECT
        COUNT(*)::int                              AS total_bills,
        ROUND(SUM(s.total_amount)::numeric,2)     AS total_revenue,
        ROUND(SUM(s.discount_amount)::numeric,2)  AS total_discount,
        ROUND(AVG(s.total_amount)::numeric,2)     AS avg_bill
      FROM sales s
      WHERE s.tenant_id=$1 AND s.created_at BETWEEN $2 AND $3`,
      [tid, start, end],
    );

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

    return this.ds.query(`
      SELECT
        COALESCE(p.first_name || ' ' || COALESCE(p.last_name,''), s.customer_name) AS patient_name,
        COALESCE(p.mobile, '')                           AS mobile,
        COALESCE(p.gender, '')                           AS gender,
        CASE WHEN p.date_of_birth IS NOT NULL
             THEN EXTRACT(YEAR FROM AGE(p.date_of_birth))::int
             ELSE NULL END                               AS age,
        COUNT(DISTINCT s.id)::int                        AS visit_count,
        MAX(s.created_at)::date                          AS last_visit,
        ROUND(SUM(s.total_amount)::numeric, 2)           AS total_spent,
        ROUND(AVG(s.total_amount)::numeric, 2)           AS avg_bill
      FROM sales s
      LEFT JOIN patients p ON p.mobile = s.customer_phone OR p.first_name || ' ' || COALESCE(p.last_name,'') = s.customer_name
      WHERE s.tenant_id = $1
        AND s.created_at BETWEEN $2 AND $3
      GROUP BY
        COALESCE(p.first_name || ' ' || COALESCE(p.last_name,''), s.customer_name),
        p.mobile, p.gender, p.date_of_birth
      ORDER BY total_spent DESC
      LIMIT 200`,
      [tid, start, end],
    );
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
}
