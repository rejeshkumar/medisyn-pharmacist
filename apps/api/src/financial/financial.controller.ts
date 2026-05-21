// financial.controller.ts
// Place at: apps/api/src/financial/financial.controller.ts

import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
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
      `INSERT INTO expenses (tenant_id, expense_date, category, description, amount, payment_mode, reference_no, vendor_name, paid_by, voucher_amount, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [tenant_id, body.expense_date || new Date().toISOString().split('T')[0],
       body.category, body.description, body.amount,
       body.payment_mode || 'cash', body.reference_no || null,
       body.vendor_name || null, body.paid_by || 'PHARMACY',
       body.voucher_amount || null, sub]
    );
    return r[0];
  }

  @Delete('expenses/:id')
  async deleteExpense(@Param('id') id: string, @Req() req: any) {
    await this.ds.query(
      `DELETE FROM expenses WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  @Patch('expenses/:id')
  async updateExpense(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    // Fetch original for audit
    const original = await this.ds.query(
      `SELECT * FROM expenses WHERE id=$1 AND tenant_id=$2`,
      [id, req.user.tenant_id]
    );

    await this.ds.query(
      `UPDATE expenses SET category=$1, description=$2, amount=$3, payment_mode=$4,
       reference_no=$5, vendor_name=$6, updated_at=NOW(), updated_by=$9
       WHERE id=$7 AND tenant_id=$8`,
      [body.category, body.description, body.amount, body.payment_mode,
       body.reference_no, body.vendor_name, id, req.user.tenant_id, req.user.sub]
    );

    // Write audit log
    if (original[0]) {
      await this.ds.query(
        `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, old_values, new_values, notes, created_at)
         VALUES ($1,$2,'UPDATE','expense',$3,$4,$5,$6,NOW())`,
        [
          req.user.tenant_id,
          req.user.sub,
          id,
          JSON.stringify({ category: original[0].category, description: original[0].description, amount: original[0].amount, payment_mode: original[0].payment_mode }),
          JSON.stringify({ category: body.category, description: body.description, amount: body.amount, payment_mode: body.payment_mode }),
          body.edit_reason || 'No reason provided',
        ]
      ).catch(() => {}); // Don't fail if audit log table structure differs
    }

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

  // ══════════════════════════════════════════════════════════════════════
  // PHARMACY PURCHASES (Vendor-wise medicine purchase tracking)
  // ══════════════════════════════════════════════════════════════════════

  @Get('pharmacy-purchases')
  async getPharmacyPurchases(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('vendor') vendor: string,
    @Query('payment_mode') paymentMode: string,
    @Query('is_paid') isPaid: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = to || new Date().toISOString().split('T')[0];

    let q = `SELECT pp.*, u.full_name as created_by_name
             FROM pharmacy_purchases pp
             LEFT JOIN users u ON u.id = pp.created_by
             WHERE pp.tenant_id = $1
               AND pp.purchase_date BETWEEN $2 AND $3`;
    const params: any[] = [tid, start, end];

    if (vendor) {
      q += ` AND pp.vendor_name ILIKE $${params.length + 1}`;
      params.push(`%${vendor}%`);
    }
    if (paymentMode) {
      q += ` AND pp.payment_mode = $${params.length + 1}`;
      params.push(paymentMode);
    }
    if (isPaid === 'true') q += ` AND pp.is_paid = true`;
    if (isPaid === 'false') q += ` AND pp.is_paid = false`;

    q += ' ORDER BY pp.purchase_date DESC, pp.created_at DESC';
    return this.ds.query(q, params);
  }

  @Get('pharmacy-purchases/summary')
  async getPharmacyPurchasesSummary(
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const end = to || new Date().toISOString().split('T')[0];

    const vendorSummary = await this.ds.query(
      `SELECT
         vendor_name,
         COUNT(*) as total_invoices,
         SUM(amount) as total_spend,
         SUM(CASE WHEN is_paid THEN amount ELSE 0 END) as paid_amount,
         SUM(CASE WHEN NOT is_paid THEN amount ELSE 0 END) as unpaid_amount,
         MAX(purchase_date) as last_purchase_date
       FROM pharmacy_purchases
       WHERE tenant_id = $1 AND purchase_date BETWEEN $2 AND $3
       GROUP BY vendor_name
       ORDER BY total_spend DESC`,
      [tid, start, end],
    );

    const modeBreakup = await this.ds.query(
      `SELECT
         payment_mode,
         COUNT(*) as count,
         SUM(amount) as total
       FROM pharmacy_purchases
       WHERE tenant_id = $1 AND purchase_date BETWEEN $2 AND $3
       GROUP BY payment_mode
       ORDER BY total DESC`,
      [tid, start, end],
    );

    const monthlyTrend = await this.ds.query(
      `SELECT
         TO_CHAR(purchase_date, 'YYYY-MM') as month,
         SUM(amount) as total,
         COUNT(*) as count
       FROM pharmacy_purchases
       WHERE tenant_id = $1 AND purchase_date BETWEEN $2 AND $3
       GROUP BY TO_CHAR(purchase_date, 'YYYY-MM')
       ORDER BY month`,
      [tid, start, end],
    );

    const totals = await this.ds.query(
      `SELECT
         SUM(amount) as total_purchases,
         SUM(CASE WHEN is_paid THEN amount ELSE 0 END) as total_paid,
         SUM(CASE WHEN NOT is_paid THEN amount ELSE 0 END) as total_unpaid,
         COUNT(*) as total_invoices
       FROM pharmacy_purchases
       WHERE tenant_id = $1 AND purchase_date BETWEEN $2 AND $3`,
      [tid, start, end],
    );

    return {
      totals: totals[0],
      vendor_summary: vendorSummary,
      mode_breakup: modeBreakup,
      monthly_trend: monthlyTrend,
    };
  }

  @Post('pharmacy-purchases')
  async addPharmacyPurchase(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO pharmacy_purchases
       (tenant_id, purchase_date, vendor_name, invoice_no, amount,
        payment_mode, paid_by, credit_period, is_paid, paid_date,
        cheque_no, reference_no, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       RETURNING *`,
      [
        tenant_id,
        body.purchase_date || new Date().toISOString().split('T')[0],
        body.vendor_name,
        body.invoice_no || null,
        body.amount,
        body.payment_mode || 'CASH',
        body.paid_by || null,
        body.credit_period || null,
        body.is_paid ?? false,
        body.paid_date || null,
        body.cheque_no || null,
        body.reference_no || null,
        body.notes || null,
        sub,
      ],
    );

    const purchase = r[0];

    // ── AUTO-LINK: Create upcoming payment if unpaid with credit period ──
    if (!purchase.is_paid && purchase.credit_period && purchase.credit_period !== 'CASH PURCHASE') {
      const days = parseInt(purchase.credit_period) || 0;
      if (days > 0) {
        const purchaseDate = new Date(purchase.purchase_date);
        const dueDate = new Date(purchaseDate);
        dueDate.setDate(dueDate.getDate() + days);

        await this.ds.query(
          `INSERT INTO upcoming_payments
           (tenant_id, payment_type, description, amount, due_date,
            source_type, source_id, notes, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            tenant_id,
            purchase.vendor_name,
            `Purchase ${purchase.invoice_no || ''} — ${purchase.credit_period} credit`.trim(),
            purchase.amount,
            dueDate.toISOString().split('T')[0],
            'pharmacy_purchase',
            purchase.id,
            purchase.notes || null,
            sub,
          ],
        );
      }
    }

    return purchase;
  }

  @Patch('pharmacy-purchases/:id')
  async updatePharmacyPurchase(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const allowed = [
      'purchase_date', 'vendor_name', 'invoice_no', 'amount',
      'payment_mode', 'paid_by', 'credit_period', 'is_paid',
      'paid_date', 'cheque_no', 'reference_no', 'notes',
    ];

    for (const f of allowed) {
      if (body[f] !== undefined) {
        fields.push(`${f} = $${idx}`);
        params.push(body[f]);
        idx++;
      }
    }
    if (fields.length === 0) return { message: 'Nothing to update' };

    fields.push(`updated_at = NOW()`);
    params.push(id, req.user.tenant_id);

    await this.ds.query(
      `UPDATE pharmacy_purchases SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}`,
      params,
    );
    return { success: true };
  }

  @Delete('pharmacy-purchases/:id')
  async deletePharmacyPurchase(@Param('id') id: string, @Req() req: any) {
    // Also delete any linked upcoming payment
    await this.ds.query(
      `DELETE FROM upcoming_payments
       WHERE source_type = 'pharmacy_purchase' AND source_id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    await this.ds.query(
      `DELETE FROM pharmacy_purchases WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  // VENDOR MASTER
  // ══════════════════════════════════════════════════════════════════════

  @Get('vendors')
  async getVendors(@Req() req: any) {
    return this.ds.query(
      `SELECT * FROM vendor_master
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY vendor_name`,
      [req.user.tenant_id],
    );
  }

  @Post('vendors')
  async addVendor(@Body() body: any, @Req() req: any) {
    const r = await this.ds.query(
      `INSERT INTO vendor_master
       (tenant_id, vendor_name, payment_mode, credit_period, contact_phone, gst_no, address)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, vendor_name)
       DO UPDATE SET payment_mode=$3, credit_period=$4,
         contact_phone=$5, gst_no=$6, address=$7, updated_at=NOW()
       RETURNING *`,
      [
        req.user.tenant_id,
        body.vendor_name,
        body.payment_mode || 'CASH',
        body.credit_period || 'CASH PURCHASE',
        body.contact_phone || null,
        body.gst_no || null,
        body.address || null,
      ],
    );
    return r[0];
  }

  // ══════════════════════════════════════════════════════════════════════
  // UPCOMING PAYMENTS
  // ══════════════════════════════════════════════════════════════════════

  @Get('upcoming-payments')
  async getUpcomingPayments(
    @Query('show_paid') showPaid: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;
    let q = `SELECT up.*, u.full_name as created_by_name
             FROM upcoming_payments up
             LEFT JOIN users u ON u.id = up.created_by
             WHERE up.tenant_id = $1`;

    if (showPaid !== 'true') {
      q += ` AND up.is_paid = false`;
    }
    q += ` ORDER BY
             CASE WHEN up.is_urgent THEN 0 ELSE 1 END,
             CASE WHEN up.due_date IS NULL THEN 1 ELSE 0 END,
             up.due_date ASC`;

    const payments = await this.ds.query(q, [tid]);

    // Get latest cash/bank balance
    const balance = await this.ds.query(
      `SELECT * FROM cash_bank_balance
       WHERE tenant_id = $1
       ORDER BY balance_date DESC LIMIT 1`,
      [tid],
    );

    const totalDue = payments
      .filter((p: any) => !p.is_paid)
      .reduce((sum: number, p: any) => sum + parseFloat(p.amount || 0), 0);

    const cashBal = balance[0]?.cash_balance || 0;
    const bankBal = balance[0]?.bank_balance || 0;
    const cheqIssued = balance[0]?.cheque_issued || 0;

    return {
      payments,
      balance: {
        cash_balance: parseFloat(cashBal),
        bank_balance: parseFloat(bankBal),
        cheque_issued: parseFloat(cheqIssued),
        total_available: parseFloat(cashBal) + parseFloat(bankBal),
        total_due: totalDue,
        fund_required: Math.max(0, totalDue - parseFloat(cashBal) - parseFloat(bankBal)),
        balance_date: balance[0]?.balance_date || null,
      },
    };
  }

  @Post('upcoming-payments')
  async addUpcomingPayment(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO upcoming_payments
       (tenant_id, payment_type, description, amount, due_date,
        is_urgent, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        tenant_id,
        body.payment_type,
        body.description || null,
        body.amount,
        body.due_date || null,
        body.is_urgent ?? false,
        body.notes || null,
        sub,
      ],
    );
    return r[0];
  }

  @Patch('upcoming-payments/:id')
  async updateUpcomingPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;

    const allowed = [
      'payment_type', 'description', 'amount', 'due_date',
      'is_urgent', 'is_paid', 'paid_date', 'paid_amount',
      'payment_mode', 'reference_no', 'notes',
    ];

    for (const f of allowed) {
      if (body[f] !== undefined) {
        fields.push(`${f} = $${idx}`);
        params.push(body[f]);
        idx++;
      }
    }
    if (fields.length === 0) return { message: 'Nothing to update' };

    fields.push(`updated_at = NOW()`);
    params.push(id, req.user.tenant_id);

    await this.ds.query(
      `UPDATE upcoming_payments SET ${fields.join(', ')}
       WHERE id = $${idx} AND tenant_id = $${idx + 1}`,
      params,
    );
    return { success: true };
  }

  @Patch('upcoming-payments/:id/mark-paid')
  async markPaymentPaid(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const result = await this.ds.query(
      `UPDATE upcoming_payments SET
         is_paid = true,
         paid_date = $1,
         paid_amount = $2,
         payment_mode = $3,
         reference_no = $4,
         updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING source_type, source_id`,
      [
        body.paid_date || new Date().toISOString().split('T')[0],
        body.paid_amount || null,
        body.payment_mode || null,
        body.reference_no || null,
        id,
        req.user.tenant_id,
      ],
    );

    // If linked to a pharmacy purchase, mark that as paid too
    const payment = result[0];
    if (payment?.source_type === 'pharmacy_purchase' && payment.source_id) {
      await this.ds.query(
        `UPDATE pharmacy_purchases SET
           is_paid = true,
           paid_date = $1,
           payment_mode = COALESCE($2, payment_mode),
           reference_no = COALESCE($3, reference_no),
           updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [
          body.paid_date || new Date().toISOString().split('T')[0],
          body.payment_mode || null,
          body.reference_no || null,
          payment.source_id,
          req.user.tenant_id,
        ],
      );
    }

    // Auto-create expense entry when any upcoming payment is marked paid
    try {
      const up = await this.ds.query(
        `SELECT description, amount, payment_mode, reference_no, source_type
         FROM upcoming_payments WHERE id=$1 AND tenant_id=$2`,
        [id, req.user.tenant_id],
      );
      if (up.length > 0) {
        const category = up[0].source_type === 'purchase_order'
          ? 'Supplier Payment (PO)'
          : up[0].source_type === 'pharmacy_purchase'
          ? 'Supplier Payment'
          : 'Vendor Payment';

        await this.ds.query(
          `INSERT INTO expenses (
             tenant_id, expense_date, category, description, amount,
             payment_mode, reference_no, vendor_name, paid_by,
             voucher_amount, created_by
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            req.user.tenant_id,
            body.paid_date || new Date().toISOString().split('T')[0],
            category,
            up[0].description || 'Supplier payment',
            body.paid_amount || up[0].amount || 0,
            body.payment_mode || up[0].payment_mode || 'cash',
            body.reference_no || up[0].reference_no || null,
            up[0].description || null,
            'PHARMACY',
            null,
            req.user.sub,
          ],
        );
      }
    } catch (expErr) {
      // Expense creation failure must not affect mark-paid success
      console.error('Auto-expense creation failed (non-fatal):', expErr);
    }

    return { success: true };
  }

  @Delete('upcoming-payments/:id')
  async deleteUpcomingPayment(@Param('id') id: string, @Req() req: any) {
    await this.ds.query(
      `DELETE FROM upcoming_payments WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════
  // CASH & BANK BALANCE
  // ══════════════════════════════════════════════════════════════════════

  @Get('cash-bank-balance')
  async getCashBankBalance(@Req() req: any) {
    const r = await this.ds.query(
      `SELECT * FROM cash_bank_balance
       WHERE tenant_id = $1
       ORDER BY balance_date DESC LIMIT 1`,
      [req.user.tenant_id],
    );
    return r[0] || { cash_balance: 0, bank_balance: 0, cheque_issued: 0 };
  }

  @Post('cash-bank-balance')
  async updateCashBankBalance(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO cash_bank_balance
       (tenant_id, balance_date, cash_balance, bank_balance, cheque_issued, notes, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tenant_id, balance_date)
       DO UPDATE SET cash_balance=$3, bank_balance=$4, cheque_issued=$5,
         notes=$6, updated_by=$7, updated_at=NOW()
       RETURNING *`,
      [
        tenant_id,
        body.balance_date || new Date().toISOString().split('T')[0],
        body.cash_balance || 0,
        body.bank_balance || 0,
        body.cheque_issued || 0,
        body.notes || null,
        sub,
      ],
    );
    return r[0];
  }

  // ══════════════════════════════════════════════════════════════════════
  // DASHBOARD — Period-based aggregation (daily/weekly/monthly/yearly)
  // ══════════════════════════════════════════════════════════════════════

  @Get('dashboard-summary')
  async getDashboardSummary(
    @Query('period') period: string,
    @Query('date') date: string,
    @Query('from') fromDate: string,
    @Query('to') toDate: string,
    @Req() req: any,
  ) {
    const tid = req.user.tenant_id;

    let startDate: string, endDate: string;

    // Custom date range overrides period
    if (fromDate && toDate) {
      startDate = fromDate;
      endDate = toDate;
    } else {
    const refDate = date || new Date().toISOString().split('T')[0];
    const d = new Date(refDate);

    switch (period) {
      case 'weekly':
        const day = d.getDay();
        const monday = new Date(d);
        monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        startDate = monday.toISOString().split('T')[0];
        endDate = sunday.toISOString().split('T')[0];
        break;
      case 'monthly':
        startDate = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
        endDate = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
        break;
      case 'yearly':
        startDate = new Date(d.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = new Date(d.getFullYear(), 11, 31).toISOString().split('T')[0];
        break;
      default:
        startDate = refDate;
        endDate = refDate;
    }
    } // end else (custom range check)

    const [revenue, cogs, expenses, purchases, consultations] = await Promise.all([
      this.ds.query(
        `SELECT
           COALESCE(SUM(total_amount), 0) as total_revenue,
           COALESCE(SUM(CASE WHEN payment_mode='cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
           COALESCE(SUM(CASE WHEN payment_mode='upi' THEN total_amount ELSE 0 END), 0) as upi_revenue,
           COALESCE(SUM(CASE WHEN payment_mode='card' THEN total_amount ELSE 0 END), 0) as card_revenue,
           COUNT(*) as total_bills
         FROM sales
         WHERE tenant_id = $1 AND is_voided = false
           AND (created_at + INTERVAL '5 hours 30 minutes')::date BETWEEN $2 AND $3`,
        [tid, startDate, endDate],
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(sb.purchase_price * si.qty), 0) as total_cogs
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN stock_batches sb ON sb.id = si.batch_id
         WHERE s.tenant_id = $1 AND s.is_voided = false
           AND (s.created_at + INTERVAL '5 hours 30 minutes')::date BETWEEN $2 AND $3`,
        [tid, startDate, endDate],
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(amount), 0) as total_expenses, COUNT(*) as expense_count
         FROM expenses
         WHERE tenant_id = $1 AND expense_date BETWEEN $2 AND $3`,
        [tid, startDate, endDate],
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(amount), 0) as total_purchases, COUNT(*) as purchase_count
         FROM pharmacy_purchases
         WHERE tenant_id = $1 AND purchase_date BETWEEN $2 AND $3`,
        [tid, startDate, endDate],
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(fee_amount), 0) as total_consultation
         FROM consultations
         WHERE tenant_id = $1 AND status = 'completed'
           AND (created_at + INTERVAL '5 hours 30 minutes')::date BETWEEN $2 AND $3`,
        [tid, startDate, endDate],
      ).catch(() => [{ total_consultation: 0 }]),
    ]);

    const totalRevenue = parseFloat(revenue[0]?.total_revenue || 0) + parseFloat(consultations[0]?.total_consultation || 0);
    const totalCogs = parseFloat(cogs[0]?.total_cogs || 0);
    const grossProfit = totalRevenue - totalCogs;
    const totalExpenses = parseFloat(expenses[0]?.total_expenses || 0);
    const netProfit = grossProfit - totalExpenses;

    return {
      period,
      start_date: startDate,
      end_date: endDate,
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        pharmacy: Math.round(parseFloat(revenue[0]?.total_revenue || 0) * 100) / 100,
        consultation: Math.round(parseFloat(consultations[0]?.total_consultation || 0) * 100) / 100,
        cash: Math.round(parseFloat(revenue[0]?.cash_revenue || 0) * 100) / 100,
        upi: Math.round(parseFloat(revenue[0]?.upi_revenue || 0) * 100) / 100,
        card: Math.round(parseFloat(revenue[0]?.card_revenue || 0) * 100) / 100,
        total_bills: parseInt(revenue[0]?.total_bills || 0),
      },
      cogs: Math.round(totalCogs * 100) / 100,
      gross_profit: Math.round(grossProfit * 100) / 100,
      gross_margin: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 1000) / 10 : 0,
      expenses: Math.round(totalExpenses * 100) / 100,
      purchases: Math.round(parseFloat(purchases[0]?.total_purchases || 0) * 100) / 100,
      net_profit: Math.round(netProfit * 100) / 100,
      net_margin: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 1000) / 10 : 0,
    };
  }
}
