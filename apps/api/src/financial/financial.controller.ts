// financial.controller.ts
// Place at: apps/api/src/financial/financial.controller.ts

import { Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('financial')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FinancialController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ══════════════════════════════════════════════════════════════════════
  // DASHBOARD — Daily P&L snapshot
  // ══════════════════════════════════════════════════════════════════════

  @Get('dashboard')
  async getDashboard(@Query('date') date: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    const d   = date || new Date().toISOString().split('T')[0];

    const [revenue, expenses, cogs, supplierPayable, upiPending] = await Promise.all([

      // Today's revenue breakdown
      this.ds.query(`
        SELECT
          COALESCE(SUM(total_amount),0)::numeric(10,2)                         AS total_revenue,
          COALESCE(SUM(CASE WHEN payment_mode='cash' THEN total_amount END),0)::numeric(10,2) AS cash,
          COALESCE(SUM(CASE WHEN payment_mode='upi'  THEN total_amount END),0)::numeric(10,2) AS upi,
          COALESCE(SUM(CASE WHEN payment_mode='card' THEN total_amount END),0)::numeric(10,2) AS card,
          COALESCE(SUM(discount_amount),0)::numeric(10,2)                       AS discounts,
          COALESCE(SUM(tax_amount),0)::numeric(10,2)                            AS gst_collected,
          COUNT(*)::int                                                          AS bill_count
        FROM sales
        WHERE tenant_id=$1 AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$2
          AND is_voided=false`,
        [tid, d]
      ),

      // Today's expenses
      this.ds.query(`
        SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total_expenses,
               COUNT(*)::int AS expense_count
        FROM expenses WHERE tenant_id=$1 AND expense_date=$2`,
        [tid, d]
      ),

      // Cost of goods sold today (purchase price × qty sold)
      this.ds.query(`
        SELECT COALESCE(SUM(sb.purchase_price * si.qty),0)::numeric(10,2) AS cogs
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id
        JOIN stock_batches sb ON sb.id = si.batch_id
        WHERE s.tenant_id=$1 AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata')=$2
          AND s.is_voided=false`,
        [tid, d]
      ),

      // Total supplier payable (unpaid invoices)
      this.ds.query(`
        SELECT COALESCE(SUM(CASE WHEN entry_type='invoice' THEN amount ELSE -amount END),0)::numeric(10,2) AS total_payable
        FROM supplier_ledger WHERE tenant_id=$1`,
        [tid]
      ),

      // UPI settlements pending
      this.ds.query(`
        SELECT COALESCE(SUM(expected_amount),0)::numeric(10,2) AS pending_upi
        FROM upi_settlements WHERE tenant_id=$1 AND status='pending'`,
        [tid]
      ),
    ]);

    const rev  = Number(revenue[0]?.total_revenue || 0);
    const exp  = Number(expenses[0]?.total_expenses || 0);
    const cost = Number(cogs[0]?.cogs || 0);
    const grossProfit = rev - cost;
    const netProfit   = grossProfit - exp;
    const grossMargin = rev > 0 ? Math.round((grossProfit / rev) * 100) : 0;

    return {
      date: d,
      revenue: {
        total:     rev,
        cash:      Number(revenue[0]?.cash || 0),
        upi:       Number(revenue[0]?.upi || 0),
        card:      Number(revenue[0]?.card || 0),
        discounts: Number(revenue[0]?.discounts || 0),
        gst:       Number(revenue[0]?.gst_collected || 0),
        bills:     revenue[0]?.bill_count || 0,
      },
      cogs:          cost,
      gross_profit:  grossProfit,
      gross_margin:  grossMargin,
      expenses:      exp,
      net_profit:    netProfit,
      supplier_payable: Number(supplierPayable[0]?.total_payable || 0),
      upi_pending:      Number(upiPending[0]?.pending_upi || 0),
    };
  }

  // ── Monthly P&L ──────────────────────────────────────────────────────────
  @Get('pnl')
  async getPnL(@Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    const [dailyRevenue, expensesByCategory, cogsTotal, topMedicines] = await Promise.all([

      // Daily revenue for chart
      this.ds.query(`
        SELECT
          DATE(created_at AT TIME ZONE 'Asia/Kolkata')::text AS date,
          COALESCE(SUM(total_amount),0)::numeric(10,2)       AS revenue,
          COALESCE(SUM(discount_amount),0)::numeric(10,2)    AS discounts,
          COUNT(*)::int                                       AS bills
        FROM sales
        WHERE tenant_id=$1 AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
          AND is_voided=false
        GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
        ORDER BY date ASC`,
        [tid, start, end]
      ),

      // Expenses by category
      this.ds.query(`
        SELECT category,
               COALESCE(SUM(amount),0)::numeric(10,2) AS total,
               COUNT(*)::int AS count
        FROM expenses
        WHERE tenant_id=$1 AND expense_date BETWEEN $2 AND $3
        GROUP BY category ORDER BY total DESC`,
        [tid, start, end]
      ),

      // Total COGS for period
      this.ds.query(`
        SELECT COALESCE(SUM(sb.purchase_price * si.qty),0)::numeric(10,2) AS cogs
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN stock_batches sb ON sb.id=si.batch_id
        WHERE s.tenant_id=$1 AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
          AND s.is_voided=false`,
        [tid, start, end]
      ),

      // Top medicines by margin
      this.ds.query(`
        SELECT
          m.brand_name,
          m.category,
          SUM(si.qty)::int                                              AS qty_sold,
          ROUND(SUM(si.item_total)::numeric, 2)                        AS revenue,
          ROUND(SUM(sb.purchase_price * si.qty)::numeric, 2)           AS cost,
          ROUND((SUM(si.item_total) - SUM(sb.purchase_price * si.qty))::numeric, 2) AS gross_profit,
          ROUND(((SUM(si.item_total) - SUM(sb.purchase_price * si.qty)) / NULLIF(SUM(si.item_total),0) * 100)::numeric, 1) AS margin_pct
        FROM sale_items si
        JOIN sales s ON s.id=si.sale_id
        JOIN medicines m ON m.id=si.medicine_id
        JOIN stock_batches sb ON sb.id=si.batch_id
        WHERE s.tenant_id=$1 AND DATE(s.created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
          AND s.is_voided=false
        GROUP BY m.id, m.brand_name, m.category
        HAVING SUM(si.item_total) > 0
        ORDER BY gross_profit DESC
        LIMIT 20`,
        [tid, start, end]
      ),
    ]);

    const totalRevenue  = dailyRevenue.reduce((s: number, r: any) => s + Number(r.revenue), 0);
    const totalExpenses = expensesByCategory.reduce((s: number, e: any) => s + Number(e.total), 0);
    const totalCogs     = Number(cogsTotal[0]?.cogs || 0);
    const grossProfit   = totalRevenue - totalCogs;
    const netProfit     = grossProfit - totalExpenses;

    return {
      period: { start, end },
      summary: {
        total_revenue:  Math.round(totalRevenue * 100) / 100,
        total_cogs:     Math.round(totalCogs * 100) / 100,
        gross_profit:   Math.round(grossProfit * 100) / 100,
        gross_margin:   totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100 * 10) / 10 : 0,
        total_expenses: Math.round(totalExpenses * 100) / 100,
        net_profit:     Math.round(netProfit * 100) / 100,
        net_margin:     totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100 * 10) / 10 : 0,
      },
      daily_revenue:       dailyRevenue,
      expenses_by_category: expensesByCategory,
      top_medicines:       topMedicines,
    };
  }

  // ══════════════════════════════════════════════════════════════════════
  // EXPENSES
  // ══════════════════════════════════════════════════════════════════════

  @Get('expenses')
  async getExpenses(@Query('from') from: string, @Query('to') to: string, @Query('category') category: string, @Req() req: any) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    let q = `SELECT e.*, u.full_name as created_by_name
             FROM expenses e LEFT JOIN users u ON u.id=e.created_by
             WHERE e.tenant_id=$1 AND e.expense_date BETWEEN $2 AND $3`;
    const params: any[] = [tid, start, end];
    if (category) { q += ` AND e.category=$${params.length + 1}`; params.push(category); }
    q += ' ORDER BY e.expense_date DESC, e.created_at DESC';

    return this.ds.query(q, params);
  }

  @Post('expenses')
  async addExpense(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO expenses (tenant_id, expense_date, category, description, amount, payment_mode, reference_no, vendor_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [tenant_id, body.expense_date || new Date().toISOString().split('T')[0],
       body.category, body.description, body.amount,
       body.payment_mode || 'cash', body.reference_no || null,
       body.vendor_name || null, sub]
    );
    return r[0];
  }

  @Patch('expenses/:id')
  async updateExpense(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.ds.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, payment_mode=$4,
       reference_no=$5, vendor_name=$6, updated_at=NOW()
       WHERE id=$7 AND tenant_id=$8`,
      [body.category, body.description, body.amount, body.payment_mode,
       body.reference_no, body.vendor_name, id, req.user.tenant_id]
    );
    return { updated: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  // SUPPLIER LEDGER & PAYABLES
  // ══════════════════════════════════════════════════════════════════════

  @Get('payables')
  async getPayables(@Req() req: any) {
    const tid = req.user.tenant_id;
    return this.ds.query(`
      SELECT
        COALESCE(sl.supplier_id::text, 'unknown') AS supplier_id,
        sl.supplier_name,
        COALESCE(SUM(CASE WHEN sl.entry_type='invoice' THEN sl.amount ELSE 0 END),0)::numeric(10,2) AS total_invoiced,
        COALESCE(SUM(CASE WHEN sl.entry_type='payment' THEN sl.amount ELSE 0 END),0)::numeric(10,2) AS total_paid,
        COALESCE(SUM(CASE WHEN sl.entry_type='invoice' THEN sl.amount ELSE -sl.amount END),0)::numeric(10,2) AS balance,
        MIN(sl.due_date) FILTER (WHERE sl.entry_type='invoice' AND sl.due_date < CURRENT_DATE) AS oldest_due,
        COUNT(CASE WHEN sl.entry_type='invoice' AND sl.due_date < CURRENT_DATE THEN 1 END)::int AS overdue_count
      FROM supplier_ledger sl
      WHERE sl.tenant_id=$1
      GROUP BY sl.supplier_id, sl.supplier_name
      HAVING SUM(CASE WHEN sl.entry_type='invoice' THEN sl.amount ELSE -sl.amount END) > 0
      ORDER BY balance DESC`,
      [tid]
    );
  }

  @Get('supplier-ledger/:supplier_name')
  async getSupplierLedger(@Param('supplier_name') name: string, @Req() req: any) {
    return this.ds.query(
      `SELECT * FROM supplier_ledger WHERE tenant_id=$1 AND supplier_name ILIKE $2
       ORDER BY entry_date DESC LIMIT 50`,
      [req.user.tenant_id, `%${name}%`]
    );
  }

  @Post('supplier-ledger')
  async addLedgerEntry(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO supplier_ledger (tenant_id, supplier_id, supplier_name, entry_date, entry_type, amount, reference_no, due_date, notes, payment_mode, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenant_id, body.supplier_id || null, body.supplier_name,
       body.entry_date || new Date().toISOString().split('T')[0],
       body.entry_type, body.amount, body.reference_no || null,
       body.due_date || null, body.notes || null,
       body.payment_mode || null, sub]
    );
    return r[0];
  }

  // ══════════════════════════════════════════════════════════════════════
  // SALARY PAYMENTS
  // ══════════════════════════════════════════════════════════════════════

  @Get('salaries')
  async getSalaries(@Query('month') month: string, @Req() req: any) {
    if (!['owner','office_manager'].includes(req.user.role)) throw new Error('Forbidden');
    const tid = req.user.tenant_id;
    const m   = month || new Date().toISOString().slice(0, 7);

    // Get staff list with salary records for the month
    const staff = await this.ds.query(
      `SELECT u.id, u.full_name, u.role, u.mobile,
              sp.id as payment_id, sp.basic_salary, sp.allowances,
              sp.deductions, sp.net_salary, sp.payment_date,
              sp.payment_mode, sp.status, sp.reference_no, sp.payment_month
       FROM users u
       LEFT JOIN salary_payments sp ON sp.user_id=u.id AND sp.tenant_id=$1 AND sp.payment_month=$2
       WHERE u.tenant_id=$1 AND u.is_active=true
       ORDER BY u.full_name ASC`,
      [tid, m]
    );
    return staff;
  }

  @Post('salaries')
  async saveSalary(@Body() body: any, @Req() req: any) {
    if (!['owner','office_manager'].includes(req.user.role)) throw new Error('Forbidden');
    const { tenant_id, sub } = req.user;
    const net = Number(body.basic_salary||0) + Number(body.allowances||0) - Number(body.deductions||0);

    const r = await this.ds.query(
      `INSERT INTO salary_payments
         (tenant_id, user_id, employee_name, payment_month, basic_salary, allowances, deductions, net_salary, payment_date, payment_mode, reference_no, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (tenant_id, user_id, payment_month)
       DO UPDATE SET basic_salary=$5, allowances=$6, deductions=$7, net_salary=$8,
         payment_date=$9, payment_mode=$10, reference_no=$11, status=$12, notes=$13, updated_at=NOW()
       RETURNING *`,
      [tenant_id, body.user_id, body.employee_name, body.payment_month,
       body.basic_salary||0, body.allowances||0, body.deductions||0, net,
       body.payment_date||null, body.payment_mode||'bank_transfer',
       body.reference_no||null, body.status||'pending', body.notes||null, sub]
    );
    return r[0];
  }

  @Patch('salaries/:id/mark-paid')
  async markSalaryPaid(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.ds.query(
      `UPDATE salary_payments SET status='paid', payment_date=$1, reference_no=$2, updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4`,
      [body.payment_date || new Date().toISOString().split('T')[0],
       body.reference_no || null, id, req.user.tenant_id]
    );
    return { updated: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  // UPI RECONCILIATION
  // ══════════════════════════════════════════════════════════════════════

  @Get('upi-settlements')
  async getUpiSettlements(@Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    // Get UPI sales by day
    const upiSales = await this.ds.query(`
      SELECT
        DATE(created_at AT TIME ZONE 'Asia/Kolkata')::text AS date,
        COALESCE(SUM(total_amount),0)::numeric(10,2) AS expected_amount,
        COUNT(*)::int AS bill_count
      FROM sales
      WHERE tenant_id=$1 AND payment_mode='upi' AND is_voided=false
        AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $2 AND $3
      GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata')
      ORDER BY date DESC`,
      [tid, start, end]
    );

    // Get existing settlement records
    const settlements = await this.ds.query(
      `SELECT * FROM upi_settlements WHERE tenant_id=$1 AND settlement_date BETWEEN $2 AND $3
       ORDER BY settlement_date DESC`,
      [tid, start, end]
    );

    // Merge — for each day's UPI sales, show settlement status
    return upiSales.map((day: any) => {
      const settlement = settlements.find((s: any) => s.settlement_date === day.date);
      return {
        date:             day.date,
        expected_amount:  Number(day.expected_amount),
        bill_count:       day.bill_count,
        settled_amount:   settlement ? Number(settlement.settled_amount) : null,
        difference:       settlement ? Number(settlement.difference) : null,
        status:           settlement?.status || 'pending',
        upi_app:          settlement?.upi_app || null,
        bank_reference:   settlement?.bank_reference || null,
        settlement_id:    settlement?.id || null,
      };
    });
  }

  @Post('upi-settlements')
  async addUpiSettlement(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO upi_settlements (tenant_id, settlement_date, upi_app, expected_amount, settled_amount, bank_reference, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT DO NOTHING RETURNING *`,
      [tenant_id, body.settlement_date, body.upi_app, body.expected_amount,
       body.settled_amount, body.bank_reference||null,
       body.settled_amount ? 'reconciled' : 'pending',
       body.notes||null, sub]
    );
    return r[0];
  }

  @Patch('upi-settlements/:id')
  async updateUpiSettlement(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.ds.query(
      `UPDATE upi_settlements SET settled_amount=$1, bank_reference=$2, upi_app=$3,
       status=CASE WHEN $1 IS NOT NULL THEN 'reconciled' ELSE 'pending' END, notes=$4
       WHERE id=$5 AND tenant_id=$6`,
      [body.settled_amount||null, body.bank_reference||null, body.upi_app||null,
       body.notes||null, id, req.user.tenant_id]
    );
    return { updated: true };
  }
}
