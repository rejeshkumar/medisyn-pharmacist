// financial3.controller.ts
// Place at: apps/api/src/financial/financial3.controller.ts
// Handles: Budget vs Actual, GSTR-2, Purchase Invoice Matching, Drug Inspector Report

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const BUDGET_CATEGORIES = [
  'Revenue Target',
  'Medicine Purchases',
  'Salary & Wages',
  'Rent',
  'Electricity & Utilities',
  'Packaging & Supplies',
  'Marketing',
  'Maintenance',
  'Miscellaneous',
];

@Controller('financial')
@UseGuards(JwtAuthGuard, TenantGuard)
export class Financial3Controller {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ══════════════════════════════════════════════════════════════════════
  // BUDGET VS ACTUAL
  // ══════════════════════════════════════════════════════════════════════

  @Get('budget')
  async getBudget(@Query('month') month: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    const m   = month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = m.split('-').map(Number);
    const start = `${m}-01`;
    const end   = new Date(yr, mo, 0).toISOString().split('T')[0];

    // Get budgets for month
    const budgets = await this.ds.query(
      `SELECT * FROM budgets WHERE tenant_id=$1 AND budget_month=$2 ORDER BY category`,
      [tid, m]
    );

    // Get actuals for each category
    const [revenue, purchases, salaries, expenses] = await Promise.all([
      this.ds.query(
        `SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS actual
         FROM sales WHERE tenant_id=$1 AND is_voided=false
         AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3`,
        [tid, start, end]
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS actual
         FROM purchase_invoices WHERE tenant_id=$1
         AND invoice_date BETWEEN $2 AND $3`,
        [tid, start, end]
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(net_salary),0)::numeric(10,2) AS actual
         FROM salary_payments WHERE tenant_id=$1 AND payment_month=$2`,
        [tid, m]
      ),
      this.ds.query(
        `SELECT category, COALESCE(SUM(amount),0)::numeric(10,2) AS actual
         FROM expenses WHERE tenant_id=$1 AND expense_date BETWEEN $2 AND $3
         GROUP BY category`,
        [tid, start, end]
      ),
    ]);

    // Build actuals map
    const actuals: Record<string, number> = {
      'Revenue Target':       Number(revenue[0]?.actual || 0),
      'Medicine Purchases':   Number(purchases[0]?.actual || 0),
      'Salary & Wages':       Number(salaries[0]?.actual || 0),
    };
    expenses.forEach((e: any) => {
      actuals[e.category] = Number(e.actual);
    });

    // Merge budgets with actuals
    const result = BUDGET_CATEGORIES.map(cat => {
      const budget = budgets.find((b: any) => b.category === cat);
      const actual = actuals[cat] || 0;
      const budgeted = Number(budget?.budgeted_amount || 0);
      const variance = cat === 'Revenue Target'
        ? actual - budgeted  // positive = over target (good)
        : budgeted - actual; // positive = under budget (good)
      const pct = budgeted > 0 ? Math.round((actual / budgeted) * 100) : null;

      return {
        id:        budget?.id || null,
        category:  cat,
        budgeted,
        actual,
        variance,
        variance_pct: pct,
        status: budgeted === 0 ? 'unset'
          : cat === 'Revenue Target'
            ? (actual >= budgeted ? 'on_track' : 'behind')
            : (actual <= budgeted ? 'on_track' : 'over_budget'),
      };
    });

    return { month: m, period: { start, end }, items: result };
  }

  @Post('budget')
  async setBudget(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO budgets (tenant_id, budget_month, category, budgeted_amount, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, budget_month, category)
       DO UPDATE SET budgeted_amount=$4, notes=$5, updated_at=NOW()
       RETURNING *`,
      [tenant_id, body.month, body.category, body.amount, body.notes||null, sub]
    );
    return r[0];
  }

  @Post('budget/bulk')
  async setBudgetBulk(@Body() body: { month: string; items: any[] }, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    for (const item of body.items) {
      if (!item.amount && item.amount !== 0) continue;
      await this.ds.query(
        `INSERT INTO budgets (tenant_id, budget_month, category, budgeted_amount, created_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, budget_month, category)
         DO UPDATE SET budgeted_amount=$4, updated_at=NOW()`,
        [tenant_id, body.month, item.category, item.amount, sub]
      );
    }
    return { saved: body.items.length };
  }

  // Copy last month's budget
  @Post('budget/copy-last-month')
  async copyLastMonth(@Body() body: { month: string }, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const [yr, mo] = body.month.split('-').map(Number);
    const lastMonth = mo === 1
      ? `${yr-1}-12`
      : `${yr}-${String(mo-1).padStart(2,'0')}`;

    const last = await this.ds.query(
      `SELECT category, budgeted_amount FROM budgets
       WHERE tenant_id=$1 AND budget_month=$2`,
      [tenant_id, lastMonth]
    );

    if (!last.length) return { copied: 0, message: 'No budget found for last month' };

    for (const item of last) {
      await this.ds.query(
        `INSERT INTO budgets (tenant_id, budget_month, category, budgeted_amount, created_by)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (tenant_id, budget_month, category) DO NOTHING`,
        [tenant_id, body.month, item.category, item.budgeted_amount, sub]
      );
    }
    return { copied: last.length, from: lastMonth };
  }

  // ══════════════════════════════════════════════════════════════════════
  // GSTR-2 INPUT TAX CREDIT
  // ══════════════════════════════════════════════════════════════════════

  @Get('gstr2')
  async getGSTR2(@Query('month') month: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    const m   = month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = m.split('-').map(Number);
    const start = `${m}-01`;
    const end   = new Date(yr, mo, 0).toISOString().split('T')[0];

    const [entries, summary] = await Promise.all([
      this.ds.query(
        `SELECT * FROM gstr2_entries
         WHERE tenant_id=$1 AND invoice_date BETWEEN $2 AND $3
         ORDER BY invoice_date DESC`,
        [tid, start, end]
      ),
      this.ds.query(
        `SELECT
           COUNT(*)::int                                         AS total_invoices,
           COALESCE(SUM(taxable_amount),0)::numeric(10,2)       AS total_taxable,
           COALESCE(SUM(cgst_amount),0)::numeric(10,2)          AS total_cgst,
           COALESCE(SUM(sgst_amount),0)::numeric(10,2)          AS total_sgst,
           COALESCE(SUM(igst_amount),0)::numeric(10,2)          AS total_igst,
           COALESCE(SUM(total_tax),0)::numeric(10,2)            AS total_itc_available,
           COALESCE(SUM(CASE WHEN itc_claimed THEN total_tax END),0)::numeric(10,2) AS total_itc_claimed
         FROM gstr2_entries
         WHERE tenant_id=$1 AND invoice_date BETWEEN $2 AND $3
           AND eligible_itc=true`,
        [tid, start, end]
      ),
    ]);

    // Also get GSTR-1 outward tax for net computation
    const outward = await this.ds.query(
      `SELECT COALESCE(SUM(tax_amount),0)::numeric(10,2) AS gst_collected
       FROM sales WHERE tenant_id=$1 AND is_voided=false
       AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3`,
      [tid, start, end]
    );

    const itcAvailable = Number(summary[0]?.total_itc_available || 0);
    const gstCollected = Number(outward[0]?.gst_collected || 0);
    const netPayable   = Math.max(0, gstCollected - itcAvailable);

    return {
      month: m,
      summary: {
        ...summary[0],
        gst_collected:  gstCollected,
        itc_available:  itcAvailable,
        net_gst_payable: netPayable,
        savings:        Math.min(itcAvailable, gstCollected),
      },
      entries,
    };
  }

  @Post('gstr2')
  async addGSTR2Entry(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    // Auto-calculate tax if not provided
    const taxable = Number(body.taxable_amount || body.invoice_amount * 0.88);
    const gstRate = Number(body.gst_rate || 12);
    const cgst = body.cgst_amount || Math.round(taxable * gstRate / 200 * 100) / 100;
    const sgst = body.sgst_amount || cgst;
    const igst = body.igst_amount || 0;

    const r = await this.ds.query(
      `INSERT INTO gstr2_entries
         (tenant_id, invoice_date, supplier_name, supplier_gstin, invoice_number,
          invoice_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
          hsn_code, eligible_itc, purchase_order_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [tenant_id, body.invoice_date, body.supplier_name, body.supplier_gstin||null,
       body.invoice_number, body.invoice_amount, taxable, cgst, sgst, igst,
       body.hsn_code||'3004', body.eligible_itc!==false,
       body.purchase_order_id||null, sub]
    );
    return r[0];
  }

  @Patch('gstr2/:id/claim-itc')
  async claimITC(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.ds.query(
      `UPDATE gstr2_entries SET itc_claimed=true, itc_claimed_month=$1
       WHERE id=$2 AND tenant_id=$3`,
      [body.month || new Date().toISOString().slice(0, 7), id, req.user.tenant_id]
    );
    return { updated: true };
  }

  // Auto-import from purchase invoices
  @Post('gstr2/auto-import')
  async autoImportGSTR2(@Body() body: { month: string }, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const m = body.month || new Date().toISOString().slice(0, 7);
    const [yr, mo] = m.split('-').map(Number);
    const start = `${m}-01`;
    const end   = new Date(yr, mo, 0).toISOString().split('T')[0];

    // Get purchase invoices not yet in GSTR-2
    const invoices = await this.ds.query(
      `SELECT pi.* FROM purchase_invoices pi
       WHERE pi.tenant_id=$1 AND pi.invoice_date BETWEEN $2 AND $3
         AND NOT EXISTS (
           SELECT 1 FROM gstr2_entries g
           WHERE g.invoice_number=pi.invoice_number AND g.tenant_id=$1
         )`,
      [tenant_id, start, end]
    );

    let imported = 0;
    for (const inv of invoices) {
      const taxable = Number(inv.subtotal || 0);
      await this.ds.query(
        `INSERT INTO gstr2_entries
           (tenant_id, invoice_date, supplier_name, invoice_number,
            invoice_amount, taxable_amount, cgst_amount, sgst_amount,
            purchase_order_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [tenant_id, inv.invoice_date, inv.supplier_name,
         inv.invoice_number, inv.total_amount, taxable,
         Number(inv.cgst||0), Number(inv.sgst||0),
         inv.matched_po_id||null, sub]
      );
      imported++;
    }
    return { imported, message: `Imported ${imported} invoices into GSTR-2` };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PURCHASE INVOICE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════

  @Get('purchase-invoices')
  async getPurchaseInvoices(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('status') status: string,
    @Req() req: any
  ) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    let q = `SELECT pi.*, s.name as supplier_contact
             FROM purchase_invoices pi
             LEFT JOIN suppliers s ON s.id=pi.supplier_id
             WHERE pi.tenant_id=$1 AND pi.invoice_date BETWEEN $2 AND $3`;
    const params: any[] = [tid, start, end];
    if (status) { q += ` AND pi.payment_status=$${params.length+1}`; params.push(status); }
    q += ` ORDER BY pi.invoice_date DESC`;

    return this.ds.query(q, params);
  }

  @Post('purchase-invoices')
  async createPurchaseInvoice(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    // Calculate due date from credit days
    const dueDate = body.credit_days
      ? new Date(new Date(body.invoice_date).getTime() + body.credit_days * 86400000)
          .toISOString().split('T')[0]
      : null;

    const r = await this.ds.query(
      `INSERT INTO purchase_invoices
         (tenant_id, invoice_date, invoice_number, supplier_id, supplier_name,
          supplier_gstin, subtotal, cgst, sgst, igst, total_amount,
          credit_days, due_date, matched_po_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
      [tenant_id, body.invoice_date, body.invoice_number,
       body.supplier_id||null, body.supplier_name,
       body.supplier_gstin||null,
       body.subtotal||0, body.cgst||0, body.sgst||0, body.igst||0,
       body.total_amount,
       body.credit_days||0, dueDate,
       body.matched_po_id||null, body.notes||null, sub]
    );

    // Auto-create supplier ledger entry
    await this.ds.query(
      `INSERT INTO supplier_ledger
         (tenant_id, supplier_name, entry_date, entry_type, amount, reference_no, due_date, notes, created_by)
       VALUES ($1,$2,$3,'invoice',$4,$5,$6,$7,$8)`,
      [tenant_id, body.supplier_name, body.invoice_date,
       body.total_amount, body.invoice_number, dueDate,
       `Invoice ${body.invoice_number}`, sub]
    );

    return r[0];
  }

  @Patch('purchase-invoices/:id/pay')
  async markInvoicePaid(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    const inv = await this.ds.query(
      `UPDATE purchase_invoices
       SET paid_amount=$1, paid_date=$2, payment_mode=$3, payment_status='paid'
       WHERE id=$4 AND tenant_id=$5 RETURNING *`,
      [body.amount, body.paid_date||new Date().toISOString().split('T')[0],
       body.payment_mode||'bank_transfer', id, tenant_id]
    );

    if (inv.length) {
      // Add payment to supplier ledger
      await this.ds.query(
        `INSERT INTO supplier_ledger
           (tenant_id, supplier_name, entry_date, entry_type, amount, reference_no, payment_mode, notes, created_by)
         VALUES ($1,$2,$3,'payment',$4,$5,$6,$7,$8)`,
        [tenant_id, inv[0].supplier_name,
         body.paid_date||new Date().toISOString().split('T')[0],
         body.amount, body.reference_no||null, body.payment_mode||'bank_transfer',
         `Payment for invoice ${inv[0].invoice_number}`, sub]
      );
    }
    return inv[0];
  }

  @Get('purchase-invoices/match-po')
  async matchWithPO(@Query('supplier') supplier: string, @Query('amount') amount: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    return this.ds.query(
      `SELECT po.id, po.po_number, po.supplier_name, po.total_amount,
              po.status, po.created_at,
              ABS(po.total_amount - $3)::numeric(10,2) AS amount_diff
       FROM purchase_orders po
       WHERE po.tenant_id=$1
         AND po.supplier_name ILIKE $2
         AND po.payment_status != 'paid'
       ORDER BY amount_diff ASC, po.created_at DESC
       LIMIT 5`,
      [tid, `%${supplier}%`, Number(amount)||0]
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // DRUG INSPECTOR REPORT (Fixed Form17 + Schedule H log)
  // ══════════════════════════════════════════════════════════════════════

  @Get('drug-inspector-report')
  async getDrugInspectorReport(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('schedule') schedule: string,
    @Req() req: any
  ) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];
    const schedules = schedule ? [schedule] : ['H', 'H1', 'X'];

    const entries = await this.ds.query(
      `SELECT
         s.created_at::date::text          AS date,
         s.bill_number,
         s.customer_name                   AS patient_name,
         s.doctor_name,
         s.doctor_reg_no,
         m.brand_name                      AS medicine_name,
         m.molecule                        AS generic_name,
         m.schedule_class::text            AS schedule_class,
         m.strength,
         sb.batch_number,
         sb.expiry_date::text              AS expiry_date,
         si.qty                            AS quantity_dispensed,
         u.full_name                       AS pharmacist_name,
         si.is_substituted,
         si.substitution_reason
       FROM sale_items si
       JOIN sales s      ON s.id  = si.sale_id
       JOIN medicines m  ON m.id  = si.medicine_id
       LEFT JOIN stock_batches sb ON sb.id = si.batch_id
       LEFT JOIN users u ON u.id::text = s.created_by
       WHERE s.tenant_id = $1
         AND s.is_voided = false
         AND s.created_at::date BETWEEN $2 AND $3
         AND m.schedule_class::text = ANY($4)
       ORDER BY s.created_at DESC, m.schedule_class DESC`,
      [tid, start, end, schedules]
    );

    // Summary stats
    const summary = {
      total_entries: entries.length,
      schedule_h:    entries.filter((e: any) => e.schedule_class === 'H').length,
      schedule_h1:   entries.filter((e: any) => e.schedule_class === 'H1').length,
      schedule_x:    entries.filter((e: any) => e.schedule_class === 'X').length,
      unique_medicines: [...new Set(entries.map((e: any) => e.medicine_name))].length,
      period: { start, end },
    };

    return { summary, entries };
  }

  @Get('drug-inspector-report/pdf')
  async downloadDrugInspectorPDF(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
    @Req() req: any
  ) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    const data = await this.getDrugInspectorReport(from, to, '', req);

    // Get clinic info
    const clinic = await this.ds.query(
      `SELECT name FROM tenants WHERE id=$1`, [tid]
    ).catch(() => [{ name: 'MediSyn Speciality Clinic' }]);

    const clinicName = clinic[0]?.name || 'MediSyn Speciality Clinic';

    // Generate simple HTML-based report
    const html = this.generateDrugInspectorHTML(data, clinicName, start, end);

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `inline; filename="DrugInspectorReport_${start}_${end}.html"`);
    res.send(html);
  }

  private generateDrugInspectorHTML(data: any, clinicName: string, start: string, end: string): string {
    const { summary, entries } = data;

    const rows = entries.map((e: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.date}</td>
        <td>${e.bill_number}</td>
        <td><strong>${e.medicine_name}</strong><br/><small>${e.generic_name}</small></td>
        <td><span class="badge badge-${e.schedule_class.toLowerCase()}">${e.schedule_class}</span></td>
        <td>${e.batch_number || '—'}</td>
        <td>${e.quantity_dispensed}</td>
        <td>${e.patient_name || 'Walk-in'}</td>
        <td>${e.doctor_name || '—'}</td>
        <td>${e.pharmacist_name || '—'}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Drug Inspector Report</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11px; color: #333; margin: 20px; }
    h1 { font-size: 16px; color: #00475a; margin: 0; }
    h2 { font-size: 13px; color: #555; margin: 4px 0 0 0; }
    .header { border-bottom: 2px solid #00475a; padding-bottom: 10px; margin-bottom: 15px; }
    .meta { font-size: 10px; color: #777; margin-top: 4px; }
    .summary { display: flex; gap: 20px; margin-bottom: 15px; }
    .stat { background: #f5f5f5; padding: 8px 12px; border-radius: 6px; text-align: center; }
    .stat .val { font-size: 20px; font-weight: bold; color: #00475a; }
    .stat .lbl { font-size: 10px; color: #777; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #00475a; color: white; padding: 6px 4px; text-align: left; }
    td { padding: 5px 4px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f9f9f9; }
    .badge { padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; }
    .badge-h  { background: #fef3c7; color: #92400e; }
    .badge-h1 { background: #fee2e2; color: #991b1b; }
    .badge-x  { background: #ede9fe; color: #5b21b6; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
    @media print { body { margin: 10px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${clinicName}</h1>
    <h2>Schedule Drug Dispensing Register — Drug Inspector Report</h2>
    <p class="meta">Period: ${start} to ${end} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-IN')}</p>
  </div>

  <div class="summary">
    <div class="stat"><div class="val">${summary.total_entries}</div><div class="lbl">Total Entries</div></div>
    <div class="stat"><div class="val">${summary.schedule_h}</div><div class="lbl">Schedule H</div></div>
    <div class="stat"><div class="val">${summary.schedule_h1}</div><div class="lbl">Schedule H1</div></div>
    <div class="stat"><div class="val">${summary.schedule_x}</div><div class="lbl">Schedule X</div></div>
    <div class="stat"><div class="val">${summary.unique_medicines}</div><div class="lbl">Unique Medicines</div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th><th>Date</th><th>Bill No</th><th>Medicine</th><th>Schedule</th>
        <th>Batch</th><th>Qty</th><th>Patient</th><th>Doctor</th><th>Pharmacist</th>
      </tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="10" style="text-align:center;padding:20px;color:#999">No scheduled drug dispensing in this period</td></tr>'}</tbody>
  </table>

  <div class="footer">
    <p>This report is generated from MediSyn Pharmacy Management System.</p>
    <p>Pharmacist Signature: _________________________ &nbsp;&nbsp; Date: _____________</p>
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
  }
}
