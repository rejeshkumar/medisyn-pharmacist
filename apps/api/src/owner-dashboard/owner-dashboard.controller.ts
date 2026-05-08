import { Controller, Get, Query, Req, UseGuards, Post, Body, Patch, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('owner-dashboard')
@UseGuards(JwtAuthGuard)
export class OwnerDashboardController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── THE SINGLE-SCREEN COMMAND CENTER ───────────────────────────
  @Get()
  async getDashboard(@Req() req: any) {
    const tid = req.user.tenant_id;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const istOffset = `+ INTERVAL '5 hours 30 minutes'`;

    // Run all queries in parallel
    const [
      todayRevenue,
      mtdRevenue,
      todayExpenses,
      mtdExpenses,
      paymentModeSplit,
      vendorPayables,
      overduePayables,
      upcomingDues,
      topVendorSpend,
      topMarginMedicines,
      recentSales,
      recentExpenses,
      mtdPurchaseCost,
    ] = await Promise.all([

      // 1. Today's revenue
      this.ds.query(`
        SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS amount,
               COUNT(*)::int AS bill_count
        FROM sales
        WHERE tenant_id=$1 AND is_voided=false
          AND (created_at ${istOffset})::date = $2`,
        [tid, todayStr]),

      // 2. MTD revenue
      this.ds.query(`
        SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS amount,
               COUNT(*)::int AS bill_count
        FROM sales
        WHERE tenant_id=$1 AND is_voided=false
          AND (created_at ${istOffset})::date >= $2
          AND (created_at ${istOffset})::date <= $3`,
        [tid, monthStart, todayStr]),

      // 3. Today's expenses
      this.ds.query(`
        SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS amount,
               COUNT(*)::int AS count
        FROM expenses
        WHERE tenant_id=$1 AND expense_date = $2`,
        [tid, todayStr]),

      // 4. MTD expenses
      this.ds.query(`
        SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS amount,
               COUNT(*)::int AS count
        FROM expenses
        WHERE tenant_id=$1 AND expense_date >= $2 AND expense_date <= $3`,
        [tid, monthStart, todayStr]),

      // 5. Payment mode split (MTD)
      this.ds.query(`
        SELECT COALESCE(payment_mode, 'cash') AS mode,
               COALESCE(SUM(total_amount),0)::numeric(10,2) AS amount,
               COUNT(*)::int AS count
        FROM sales
        WHERE tenant_id=$1 AND is_voided=false
          AND (created_at ${istOffset})::date >= $2
        GROUP BY payment_mode
        ORDER BY amount DESC`,
        [tid, monthStart]),

      // 6. Total vendor payables (outstanding balance)
      this.ds.query(`
        SELECT
          COALESCE(SUM(CASE WHEN entry_type='invoice' THEN amount ELSE -amount END),0)::numeric(10,2) AS total_outstanding,
          COUNT(DISTINCT supplier_name)::int AS vendor_count
        FROM supplier_ledger
        WHERE tenant_id=$1`,
        [tid]),

      // 7. Overdue payables (past due date)
      this.ds.query(`
        SELECT sl.supplier_name,
               COALESCE(SUM(CASE WHEN sl.entry_type='invoice' THEN sl.amount ELSE -sl.amount END),0)::numeric(10,2) AS balance,
               MIN(sl.due_date) AS oldest_due,
               vpt.credit_days,
               vpt.payment_mode AS preferred_mode
        FROM supplier_ledger sl
        LEFT JOIN vendor_payment_terms vpt
          ON vpt.tenant_id = sl.tenant_id AND vpt.supplier_name = sl.supplier_name
        WHERE sl.tenant_id=$1
          AND sl.entry_type='invoice'
          AND sl.due_date IS NOT NULL
          AND sl.due_date < CURRENT_DATE
        GROUP BY sl.supplier_name, vpt.credit_days, vpt.payment_mode
        HAVING SUM(CASE WHEN sl.entry_type='invoice' THEN sl.amount ELSE -sl.amount END) > 0
        ORDER BY balance DESC
        LIMIT 10`,
        [tid]),

      // 8. Upcoming dues (next 7 days)
      this.ds.query(`
        SELECT sl.supplier_name,
               sl.amount,
               sl.due_date,
               sl.reference_no,
               vpt.payment_mode AS preferred_mode,
               (sl.due_date - CURRENT_DATE) AS days_until_due
        FROM supplier_ledger sl
        LEFT JOIN vendor_payment_terms vpt
          ON vpt.tenant_id = sl.tenant_id AND vpt.supplier_name = sl.supplier_name
        WHERE sl.tenant_id=$1
          AND sl.entry_type='invoice'
          AND sl.due_date >= CURRENT_DATE
          AND sl.due_date <= CURRENT_DATE + INTERVAL '7 days'
        ORDER BY sl.due_date ASC
        LIMIT 15`,
        [tid]),

      // 9. Top vendor spend (this month)
      this.ds.query(`
        SELECT sl.supplier_name,
               COALESCE(SUM(sl.amount),0)::numeric(10,2) AS total_spend,
               COUNT(*)::int AS invoice_count,
               vpt.credit_days,
               vpt.payment_mode AS preferred_mode
        FROM supplier_ledger sl
        LEFT JOIN vendor_payment_terms vpt
          ON vpt.tenant_id = sl.tenant_id AND vpt.supplier_name = sl.supplier_name
        WHERE sl.tenant_id=$1
          AND sl.entry_type='invoice'
          AND sl.entry_date >= $2
        GROUP BY sl.supplier_name, vpt.credit_days, vpt.payment_mode
        ORDER BY total_spend DESC
        LIMIT 10`,
        [tid, monthStart]),

      // 10. Top margin medicines (this month)
      this.ds.query(`
        SELECT si.medicine_name,
               SUM(si.qty)::int AS total_qty,
               SUM(si.item_total)::numeric(10,2) AS total_revenue,
               SUM(si.qty * COALESCE(sb.purchase_price,0))::numeric(10,2) AS total_cost,
               (SUM(si.item_total) - SUM(si.qty * COALESCE(sb.purchase_price,0)))::numeric(10,2) AS margin
        FROM sale_items si
        JOIN sales s ON s.id = si.sale_id AND s.tenant_id = $1
        LEFT JOIN stock_batches sb ON sb.id = si.batch_id
        WHERE s.is_voided = false
          AND (s.created_at ${istOffset})::date >= $2
        GROUP BY si.medicine_name
        HAVING SUM(si.item_total) > 0
        ORDER BY margin DESC
        LIMIT 10`,
        [tid, monthStart]),

      // 11. Recent sales (last 5)
      this.ds.query(`
        SELECT bill_number, customer_name, total_amount, payment_mode,
               (created_at ${istOffset}) AS created_at_ist
        FROM sales
        WHERE tenant_id=$1 AND is_voided=false
        ORDER BY created_at DESC LIMIT 5`,
        [tid]),

      // 12. Recent expenses (last 5)
      this.ds.query(`
        SELECT category, description, amount, payment_mode, expense_date
        FROM expenses
        WHERE tenant_id=$1
        ORDER BY expense_date DESC, created_at DESC LIMIT 5`,
        [tid]),

      // 13. MTD purchase cost (stock received)
      this.ds.query(`
        SELECT COALESCE(SUM(purchase_price * quantity),0)::numeric(10,2) AS total_cost
        FROM stock_batches
        WHERE tenant_id=$1
          AND (created_at ${istOffset})::date >= $2`,
        [tid, monthStart]),
    ]);

    const mtdRev = parseFloat(mtdRevenue[0]?.amount || 0);
    const mtdExp = parseFloat(mtdExpenses[0]?.amount || 0);
    const mtdPurch = parseFloat(mtdPurchaseCost[0]?.total_cost || 0);

    return {
      today: {
        revenue: parseFloat(todayRevenue[0]?.amount || 0),
        bill_count: todayRevenue[0]?.bill_count || 0,
        expenses: parseFloat(todayExpenses[0]?.amount || 0),
        expense_count: todayExpenses[0]?.count || 0,
        net_profit: parseFloat(todayRevenue[0]?.amount || 0) - parseFloat(todayExpenses[0]?.amount || 0),
      },
      mtd: {
        revenue: mtdRev,
        bill_count: mtdRevenue[0]?.bill_count || 0,
        expenses: mtdExp,
        expense_count: mtdExpenses[0]?.count || 0,
        purchase_cost: mtdPurch,
        gross_margin: mtdRev - mtdPurch,
        net_profit: mtdRev - mtdExp - mtdPurch,
      },
      payment_modes: paymentModeSplit,
      vendor_payables: {
        total_outstanding: parseFloat(vendorPayables[0]?.total_outstanding || 0),
        vendor_count: vendorPayables[0]?.vendor_count || 0,
        overdue: overduePayables,
        upcoming_7d: upcomingDues,
      },
      top_vendors_mtd: topVendorSpend,
      top_margin_medicines: topMarginMedicines,
      recent_sales: recentSales,
      recent_expenses: recentExpenses,
    };
  }

  // ── VENDOR PAYMENT TERMS CRUD ──────────────────────────────────
  @Get('vendor-terms')
  async getVendorTerms(@Req() req: any) {
    return this.ds.query(
      `SELECT vpt.*, s.phone AS supplier_phone
       FROM vendor_payment_terms vpt
       LEFT JOIN suppliers s ON s.id = vpt.supplier_id AND s.tenant_id = vpt.tenant_id
       WHERE vpt.tenant_id=$1 AND vpt.is_active=true
       ORDER BY vpt.supplier_name`,
      [req.user.tenant_id],
    );
  }

  @Post('vendor-terms')
  async addVendorTerms(@Body() body: any, @Req() req: any) {
    const r = await this.ds.query(
      `INSERT INTO vendor_payment_terms (tenant_id, supplier_name, supplier_id, credit_days, payment_mode, notes)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (tenant_id, supplier_name) DO UPDATE SET
         credit_days=$4, payment_mode=$5, notes=$6, updated_at=NOW()
       RETURNING *`,
      [req.user.tenant_id, body.supplier_name, body.supplier_id || null,
       body.credit_days || 0, body.payment_mode || 'CASH', body.notes || null],
    );
    return r[0];
  }

  @Patch('vendor-terms/:id')
  async updateVendorTerms(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const sets: string[] = [];
    const params: any[] = [req.user.tenant_id, id];
    let idx = 3;
    if (body.credit_days !== undefined) { sets.push(`credit_days=$${idx++}`); params.push(body.credit_days); }
    if (body.payment_mode) { sets.push(`payment_mode=$${idx++}`); params.push(body.payment_mode); }
    if (body.notes !== undefined) { sets.push(`notes=$${idx++}`); params.push(body.notes); }
    sets.push('updated_at=NOW()');

    const r = await this.ds.query(
      `UPDATE vendor_payment_terms SET ${sets.join(',')} WHERE tenant_id=$1 AND id=$2 RETURNING *`,
      params,
    );
    return r[0];
  }
}
