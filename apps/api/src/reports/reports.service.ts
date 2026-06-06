import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ReportsService {
  constructor(@InjectDataSource() private db: DataSource) {}

  // ── 1. GST SUMMARY (GSTR-3B) ─────────────────────────────────────────────
  async getGstSummary(tenantId: string, month: number, year: number) {
    const salesRows = await this.db.query(`
      SELECT
        COALESCE(si.gst_percent, 0) AS gst_rate,
        SUM(si.qty * si.mrp / (1 + COALESCE(si.gst_percent,0)/100.0)) AS taxable_value,
        SUM(si.qty * si.mrp - si.qty * si.mrp / (1 + COALESCE(si.gst_percent,0)/100.0)) AS gst_collected
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      WHERE s.tenant_id = $1
        AND EXTRACT(MONTH FROM s.created_at) = $2
        AND EXTRACT(YEAR FROM s.created_at) = $3
        AND s.is_voided = false
      GROUP BY si.gst_percent ORDER BY si.gst_percent
    `, [tenantId, month, year]).catch(() => []);

    const clinicRows = await this.db.query(`
      SELECT
        COALESCE(cbi.gst_percent, 0) AS gst_rate,
        SUM(cbi.amount / (1 + COALESCE(cbi.gst_percent,0)/100.0)) AS taxable_value,
        SUM(cbi.amount - cbi.amount / (1 + COALESCE(cbi.gst_percent,0)/100.0)) AS gst_collected
      FROM clinic_bill_items cbi
      JOIN clinic_bills cb ON cb.id = cbi.bill_id
      WHERE cb.tenant_id = $1
        AND EXTRACT(MONTH FROM cb.created_at) = $2
        AND EXTRACT(YEAR FROM cb.created_at) = $3
        AND cb.is_voided = false
      GROUP BY cbi.gst_percent ORDER BY cbi.gst_percent
    `, [tenantId, month, year]).catch(() => []);

    const itcRows = await this.db.query(`
      SELECT
        COALESCE(poi.gst_percent, 0) AS gst_rate,
        SUM(poi.quantity * poi.cost_price - poi.quantity * poi.cost_price / (1 + COALESCE(poi.gst_percent,0)/100.0)) AS itc
      FROM purchase_order_items poi
      JOIN purchase_orders po ON po.id = poi.po_id
      WHERE po.tenant_id = $1
        AND EXTRACT(MONTH FROM po.order_date) = $2
        AND EXTRACT(YEAR FROM po.order_date) = $3
      GROUP BY poi.gst_percent ORDER BY poi.gst_percent
    `, [tenantId, month, year]).catch(() => []);

    const map: Record<string, any> = {};
    const add = (rows: any[], field: string) => {
      for (const r of rows) {
        const k = String(parseFloat(r.gst_rate) || 0);
        if (!map[k]) map[k] = { gst_rate: parseFloat(k), taxable_value: 0, gst_collected: 0, itc: 0 };
        map[k][field] += parseFloat(r[field]) || 0;
      }
    };
    add(salesRows, 'taxable_value'); add(salesRows, 'gst_collected');
    add(clinicRows, 'taxable_value'); add(clinicRows, 'gst_collected');
    add(itcRows, 'itc');

    const breakdown = Object.values(map)
      .sort((a: any, b: any) => a.gst_rate - b.gst_rate)
      .map((r: any) => ({
        gst_rate: r.gst_rate,
        taxable_value: +r.taxable_value.toFixed(2),
        cgst: +(r.gst_collected / 2).toFixed(2),
        sgst: +(r.gst_collected / 2).toFixed(2),
        total_gst: +r.gst_collected.toFixed(2),
        itc: +r.itc.toFixed(2),
        net_gst_payable: +(r.gst_collected - r.itc).toFixed(2),
      }));

    const totals = breakdown.reduce(
      (acc, r) => ({
        taxable_value: acc.taxable_value + r.taxable_value,
        cgst: acc.cgst + r.cgst,
        sgst: acc.sgst + r.sgst,
        total_gst: acc.total_gst + r.total_gst,
        itc: acc.itc + r.itc,
        net_gst_payable: acc.net_gst_payable + r.net_gst_payable,
      }),
      { taxable_value: 0, cgst: 0, sgst: 0, total_gst: 0, itc: 0, net_gst_payable: 0 },
    );

    return { month, year, breakdown, totals: Object.fromEntries(Object.entries(totals).map(([k,v]) => [k, +Number(v).toFixed(2)])) };
  }

  // ── 2. SCHEDULE H/H1 REGISTER ────────────────────────────────────────────
  async getScheduleHRegister(tenantId: string, from: string, to: string, schedule: string) {
    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];
    const schedules = schedule === 'H1' ? ['H1'] : ['H', 'H1'];
    const schedulePlaceholders = schedules.map((_, i) => `$${i + 4}`).join(', ');

    const entries = await this.db.query(`
      SELECT
        ROW_NUMBER() OVER (ORDER BY s.created_at, si.id) AS entry_no,
        s.created_at::date  AS sale_date,
        s.bill_number,
        COALESCE(p.name, 'Walk-in')     AS patient_name,
        COALESCE(p.mobile, '')          AS patient_mobile,
        COALESCE(p.address, '')         AS patient_address,
        COALESCE(s.referred_by, '')     AS prescriber_name,
        m.name                          AS drug_name,
        COALESCE(m.manufacturer, '')    AS manufacturer,
        si.batch_no,
        m.schedule_class::TEXT          AS schedule_class,
        si.qty,
        si.mrp                          AS unit_mrp,
        (si.qty * si.mrp)               AS total_amount,
        COALESCE(u.name, '')            AS dispensed_by
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      JOIN medicines m   ON m.id = si.medicine_id
      LEFT JOIN patients p ON p.id = s.patient_id
      LEFT JOIN users u    ON u.id = s.created_by
      WHERE s.tenant_id = $1
        AND s.is_voided = false
        AND s.created_at::date BETWEEN $2 AND $3
        AND m.schedule_class::TEXT IN (${schedulePlaceholders})
      ORDER BY s.created_at, si.id
    `, [tenantId, fromDate, toDate, ...schedules]).catch(() => []);

    return { from: fromDate, to: toDate, schedule, entries, total: entries.length };
  }

  // ── 3. ACCOUNTS RECEIVABLE AGING ─────────────────────────────────────────
  async getArAging(tenantId: string, asOf?: string) {
    const asOfDate = asOf || new Date().toISOString().split('T')[0];

    const rows = await this.db.query(`
      SELECT
        s.id, s.bill_number,
        s.created_at::date          AS bill_date,
        COALESCE(p.name,'Walk-in')  AS patient_name,
        COALESCE(p.mobile,'')       AS patient_mobile,
        s.total_amount,
        COALESCE(s.paid_amount, 0)  AS paid_amount,
        (s.total_amount - COALESCE(s.paid_amount, 0)) AS outstanding,
        ($1::date - s.created_at::date) AS days_outstanding
      FROM sales s
      LEFT JOIN patients p ON p.id = s.patient_id
      WHERE s.tenant_id = $2
        AND s.is_voided = false
        AND s.payment_mode = 'credit'
        AND s.total_amount > COALESCE(s.paid_amount, 0)
        AND s.created_at::date <= $1::date
      ORDER BY s.created_at DESC
    `, [asOfDate, tenantId]).catch(() => []);

    const buckets: Record<string, any[]> = { current: [], days_1_30: [], days_31_60: [], days_61_90: [], over_90: [] };
    for (const r of rows) {
      const days = parseInt(r.days_outstanding) || 0;
      const item = { ...r, outstanding: parseFloat(r.outstanding) || 0, total_amount: parseFloat(r.total_amount) || 0 };
      if (days <= 0)       buckets.current.push(item);
      else if (days <= 30) buckets.days_1_30.push(item);
      else if (days <= 60) buckets.days_31_60.push(item);
      else if (days <= 90) buckets.days_61_90.push(item);
      else                 buckets.over_90.push(item);
    }

    const sum = (arr: any[]) => +arr.reduce((s, r) => s + r.outstanding, 0).toFixed(2);
    return {
      as_of: asOfDate,
      summary: {
        current:    sum(buckets.current),
        days_1_30:  sum(buckets.days_1_30),
        days_31_60: sum(buckets.days_31_60),
        days_61_90: sum(buckets.days_61_90),
        over_90:    sum(buckets.over_90),
        total:      +rows.reduce((s, r) => s + (parseFloat(r.outstanding) || 0), 0).toFixed(2),
      },
      buckets,
    };
  }

  // ── 4. PROFIT & LOSS ─────────────────────────────────────────────────────
  async getProfitLoss(tenantId: string, month: number, year: number) {
    const q = (sql: string, params: any[]) => this.db.query(sql, params).catch(() => [{ v: 0 }]);

    const [[pharma], [clinic], [vip], [cogsRow]] = await Promise.all([
      q(`SELECT COALESCE(SUM(total_amount),0) AS v FROM sales
         WHERE tenant_id=$1 AND is_voided=false AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`,
        [tenantId, month, year]),
      q(`SELECT COALESCE(SUM(total_amount),0) AS v FROM clinic_bills
         WHERE tenant_id=$1 AND is_voided=false AND EXTRACT(MONTH FROM created_at)=$2 AND EXTRACT(YEAR FROM created_at)=$3`,
        [tenantId, month, year]),
      q(`SELECT COALESCE(SUM(amount_paid),0) AS v FROM vip_registrations
         WHERE tenant_id=$1 AND EXTRACT(MONTH FROM start_date)=$2 AND EXTRACT(YEAR FROM start_date)=$3`,
        [tenantId, month, year]),
      q(`SELECT COALESCE(SUM(si.qty * COALESCE(poi.cost_price, si.mrp * 0.7)), 0) AS v
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         LEFT JOIN inventory_batches ib ON ib.medicine_id = si.medicine_id AND ib.batch_no = si.batch_no
         LEFT JOIN purchase_order_items poi ON poi.id = ib.purchase_item_id
         WHERE s.tenant_id=$1 AND s.is_voided=false
           AND EXTRACT(MONTH FROM s.created_at)=$2 AND EXTRACT(YEAR FROM s.created_at)=$3`,
        [tenantId, month, year]),
    ]);

    const expRows = await this.db.query(`
      SELECT category, COALESCE(SUM(amount),0) AS total
      FROM expenses
      WHERE tenant_id=$1 AND EXTRACT(MONTH FROM expense_date)=$2 AND EXTRACT(YEAR FROM expense_date)=$3
        AND payment_type != 'income'
      GROUP BY category ORDER BY total DESC
    `, [tenantId, month, year]).catch(() => []);

    const [payroll] = await this.db.query(`
      SELECT COALESCE(SUM(net_salary),0) AS v FROM payroll
      WHERE tenant_id=$1 AND EXTRACT(MONTH FROM pay_date)=$2 AND EXTRACT(YEAR FROM pay_date)=$3
    `, [tenantId, month, year]).catch(() => [{ v: 0 }]);

    const rev = {
      pharmacy:     +(parseFloat(pharma?.v || 0)).toFixed(2),
      consultation: +(parseFloat(clinic?.v || 0)).toFixed(2),
      vip:          +(parseFloat(vip?.v || 0)).toFixed(2),
      lab:          0,
    };
    const totalRevenue = rev.pharmacy + rev.consultation + rev.vip + rev.lab;
    const cogs = +(parseFloat(cogsRow?.v || 0)).toFixed(2);
    const grossProfit = +(totalRevenue - cogs).toFixed(2);

    const opex: any[] = expRows.map((r: any) => ({ category: r.category, amount: +parseFloat(r.total).toFixed(2) }));
    const salTotal = +parseFloat(payroll?.v || 0).toFixed(2);
    if (salTotal > 0) opex.push({ category: 'Salaries & Wages', amount: salTotal });
    const totalOpex = +opex.reduce((s, r) => s + r.amount, 0).toFixed(2);
    const netProfit = +(grossProfit - totalOpex).toFixed(2);

    return {
      month, year,
      revenue: { ...rev, total: +totalRevenue.toFixed(2) },
      cogs,
      gross_profit: grossProfit,
      gross_margin_pct: totalRevenue > 0 ? +((grossProfit / totalRevenue) * 100).toFixed(1) : 0,
      operating_expenses: opex,
      total_opex: totalOpex,
      net_profit: netProfit,
      net_margin_pct: totalRevenue > 0 ? +((netProfit / totalRevenue) * 100).toFixed(1) : 0,
    };
  }

  // ── 5. STOCK LEDGER ──────────────────────────────────────────────────────
  async getStockLedger(tenantId: string, medicineId: string, from: string, to: string) {
    if (!medicineId) {
      const medicines = await this.db.query(`
        SELECT DISTINCT m.id, m.name, m.manufacturer
        FROM medicines m
        JOIN inventory_batches ib ON ib.medicine_id = m.id
        WHERE m.tenant_id = $1
        ORDER BY m.name LIMIT 300
      `, [tenantId]).catch(() => []);
      return { medicines };
    }

    const fromDate = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const [opening] = await this.db.query(`
      SELECT COALESCE(SUM(CASE WHEN type='in' THEN qty ELSE -qty END), 0) AS qty FROM (
        SELECT poi.quantity AS qty, 'in' AS type
        FROM purchase_order_items poi JOIN purchase_orders po ON po.id = poi.po_id
        WHERE po.tenant_id=$1 AND poi.medicine_id=$2 AND po.order_date < $3::date
        UNION ALL
        SELECT si.qty, 'out'
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        WHERE s.tenant_id=$1 AND si.medicine_id=$2 AND s.is_voided=false AND s.created_at::date < $3::date
        UNION ALL
        SELECT ABS(sa.quantity_change), CASE WHEN sa.quantity_change>0 THEN 'in' ELSE 'out' END
        FROM stock_adjustments sa
        WHERE sa.tenant_id=$1 AND sa.medicine_id=$2 AND sa.created_at::date < $3::date
      ) t
    `, [tenantId, medicineId, fromDate]).catch(() => [{ qty: 0 }]);

    const txns = await this.db.query(`
      SELECT * FROM (
        SELECT po.order_date AS txn_date, 'Purchase' AS txn_type, po.invoice_number AS reference,
               COALESCE(sup.name,'') AS party, poi.batch_no,
               poi.expiry_date::TEXT AS expiry_date,
               poi.quantity AS qty_in, 0 AS qty_out, poi.cost_price AS unit_price, '' AS notes
        FROM purchase_order_items poi
        JOIN purchase_orders po ON po.id = poi.po_id
        LEFT JOIN suppliers sup ON sup.id = po.supplier_id
        WHERE po.tenant_id=$1 AND poi.medicine_id=$2 AND po.order_date BETWEEN $3 AND $4
        UNION ALL
        SELECT s.created_at::date, 'Sale', s.bill_number,
               COALESCE(p.name,'Walk-in'), si.batch_no, NULL::TEXT,
               0, si.qty, si.mrp, ''
        FROM sale_items si JOIN sales s ON s.id = si.sale_id
        LEFT JOIN patients p ON p.id = s.patient_id
        WHERE s.tenant_id=$1 AND si.medicine_id=$2 AND s.is_voided=false
          AND s.created_at::date BETWEEN $3 AND $4
        UNION ALL
        SELECT sa.created_at::date,
               CASE sa.adjustment_type
                 WHEN 'supplier_return' THEN 'Supplier Return'
                 WHEN 'damage_write_off' THEN 'Write-off'
                 ELSE 'Adjustment' END,
               NULL, NULL, sa.batch_no, NULL::TEXT,
               CASE WHEN sa.quantity_change>0 THEN sa.quantity_change ELSE 0 END,
               CASE WHEN sa.quantity_change<0 THEN ABS(sa.quantity_change) ELSE 0 END,
               NULL, COALESCE(sa.reason,'')
        FROM stock_adjustments sa
        WHERE sa.tenant_id=$1 AND sa.medicine_id=$2 AND sa.created_at::date BETWEEN $3 AND $4
      ) t ORDER BY txn_date, txn_type
    `, [tenantId, medicineId, fromDate, toDate]).catch(() => []);

    let balance = parseFloat(opening?.[0]?.qty || 0);
    const entries = txns.map((t: any) => {
      const qi = parseInt(t.qty_in) || 0;
      const qo = parseInt(t.qty_out) || 0;
      balance += qi - qo;
      return { ...t, qty_in: qi, qty_out: qo, balance };
    });

    const [med] = await this.db.query(
      `SELECT name, manufacturer, schedule_class::TEXT AS schedule_class FROM medicines WHERE id=$1`,
      [medicineId]
    ).catch(() => [{}]);

    return { medicine: med || {}, from: fromDate, to: toDate, opening_balance: parseFloat(opening?.[0]?.qty || 0), closing_balance: balance, entries };
  }
}
