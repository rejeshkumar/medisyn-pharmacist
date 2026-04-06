// financial2.controller.ts
// Place at: apps/api/src/financial/financial2.controller.ts
// Handles: Cash Register, Credit Sales, Petty Cash, Bank Import

import {
  Controller, Get, Post, Patch, Body, Param,
  Query, Req, UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('financial')
@UseGuards(JwtAuthGuard, TenantGuard)
export class Financial2Controller {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ══════════════════════════════════════════════════════════════════════
  // CASH REGISTER
  // ══════════════════════════════════════════════════════════════════════

  @Get('cash-register')
  async getCashRegister(@Query('date') date: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    const d   = date || new Date().toISOString().split('T')[0];

    // Get or auto-create today's register
    let register = await this.ds.query(
      `SELECT * FROM cash_register WHERE tenant_id=$1 AND register_date=$2`,
      [tid, d]
    );

    if (!register.length) {
      // Auto-calculate from today's sales and expenses
      const [sales, expenses, prevRegister] = await Promise.all([
        this.ds.query(
          `SELECT COALESCE(SUM(total_amount),0)::numeric(10,2) AS cash_sales
           FROM sales WHERE tenant_id=$1 AND payment_mode='cash' AND is_voided=false
           AND DATE(created_at AT TIME ZONE 'Asia/Kolkata')=$2`,
          [tid, d]
        ),
        this.ds.query(
          `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS cash_expenses
           FROM expenses WHERE tenant_id=$1 AND expense_date=$2 AND payment_mode='cash'`,
          [tid, d]
        ),
        this.ds.query(
          `SELECT actual_closing FROM cash_register
           WHERE tenant_id=$1 AND register_date < $2 AND status='closed'
           ORDER BY register_date DESC LIMIT 1`,
          [tid, d]
        ),
      ]);

      const opening = Number(prevRegister[0]?.actual_closing || 0);
      register = await this.ds.query(
        `INSERT INTO cash_register (tenant_id, register_date, opening_balance, cash_sales, cash_expenses, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (tenant_id, register_date) DO UPDATE
           SET cash_sales=$4, cash_expenses=$5
         RETURNING *`,
        [tid, d, opening,
         Number(sales[0]?.cash_sales || 0),
         Number(expenses[0]?.cash_expenses || 0),
         req.user.sub]
      );
    }

    // Get denominations breakdown of bills (for counting helper)
    return register[0];
  }

  @Post('cash-register/close')
  async closeCashRegister(@Body() body: any, @Req() req: any) {
    const tid = req.user.tenant_id;
    const d   = body.date || new Date().toISOString().split('T')[0];

    const result = await this.ds.query(
      `UPDATE cash_register
       SET actual_closing=$1, difference_reason=$2, status='closed',
           closed_by=$3, closed_at=NOW(), notes=$4
       WHERE tenant_id=$5 AND register_date=$6
       RETURNING *`,
      [body.actual_closing, body.difference_reason || null,
       req.user.sub, body.notes || null, tid, d]
    );

    if (!result.length) {
      // Create and immediately close
      return this.ds.query(
        `INSERT INTO cash_register (tenant_id, register_date, opening_balance, cash_sales, cash_expenses, actual_closing, difference_reason, status, closed_by, closed_at, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'closed',$8,NOW(),$8) RETURNING *`,
        [tid, d, body.opening_balance || 0, body.cash_sales || 0,
         body.cash_expenses || 0, body.actual_closing,
         body.difference_reason || null, req.user.sub]
      );
    }
    return result[0];
  }

  @Get('cash-register/history')
  async getCashHistory(@Query('days') days: string, @Req() req: any) {
    return this.ds.query(
      `SELECT cr.*, u.full_name as closed_by_name
       FROM cash_register cr LEFT JOIN users u ON u.id=cr.closed_by
       WHERE cr.tenant_id=$1 ORDER BY cr.register_date DESC LIMIT $2`,
      [req.user.tenant_id, parseInt(days) || 30]
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // CREDIT ACCOUNTS
  // ══════════════════════════════════════════════════════════════════════

  @Get('credit-accounts')
  async getCreditAccounts(@Req() req: any) {
    return this.ds.query(
      `SELECT ca.*, 
              COALESCE((SELECT SUM(CASE WHEN ct.txn_type='bill' THEN ct.amount ELSE -ct.amount END)
               FROM credit_transactions ct WHERE ct.account_id=ca.id), 0)::numeric(10,2) AS live_balance
       FROM credit_accounts ca
       WHERE ca.tenant_id=$1 AND ca.status='active'
       ORDER BY ca.current_balance DESC`,
      [req.user.tenant_id]
    );
  }

  @Post('credit-accounts')
  async createCreditAccount(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const r = await this.ds.query(
      `INSERT INTO credit_accounts (tenant_id, patient_id, patient_name, patient_mobile, credit_limit, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, patient_id) DO UPDATE SET credit_limit=$5, notes=$6
       RETURNING *`,
      [tenant_id, body.patient_id || null, body.patient_name,
       body.patient_mobile || null, body.credit_limit || 5000,
       body.notes || null, sub]
    );
    return r[0];
  }

  @Get('credit-accounts/:id/transactions')
  async getCreditTransactions(@Param('id') id: string, @Req() req: any) {
    return this.ds.query(
      `SELECT ct.*, u.full_name as created_by_name
       FROM credit_transactions ct LEFT JOIN users u ON u.id=ct.created_by
       WHERE ct.account_id=$1 AND ct.tenant_id=$2
       ORDER BY ct.txn_date DESC, ct.created_at DESC`,
      [id, req.user.tenant_id]
    );
  }

  @Post('credit-accounts/:id/payment')
  async recordCreditPayment(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    // Add payment transaction
    await this.ds.query(
      `INSERT INTO credit_transactions (tenant_id, account_id, patient_name, txn_date, txn_type, amount, payment_mode, reference_no, notes, created_by)
       SELECT $1, $2, patient_name, $3, 'payment', $4, $5, $6, $7, $8
       FROM credit_accounts WHERE id=$2`,
      [tenant_id, id, body.payment_date || new Date().toISOString().split('T')[0],
       body.amount, body.payment_mode || 'cash',
       body.reference_no || null, body.notes || null, sub]
    );

    // Update balance
    const updated = await this.ds.query(
      `UPDATE credit_accounts SET
         current_balance = current_balance - $1,
         last_payment_date = $2,
         updated_at = NOW()
       WHERE id=$3 AND tenant_id=$4 RETURNING *`,
      [body.amount, body.payment_date || new Date().toISOString().split('T')[0], id, tenant_id]
    );
    return updated[0];
  }

  @Get('credit-summary')
  async getCreditSummary(@Req() req: any) {
    const tid = req.user.tenant_id;
    const [summary, overdue] = await Promise.all([
      this.ds.query(
        `SELECT COUNT(*)::int as total_accounts,
                COALESCE(SUM(current_balance),0)::numeric(10,2) as total_outstanding,
                COUNT(CASE WHEN current_balance > credit_limit THEN 1 END)::int as over_limit
         FROM credit_accounts WHERE tenant_id=$1 AND status='active'`,
        [tid]
      ),
      this.ds.query(
        `SELECT patient_name, patient_mobile, current_balance, credit_limit,
                last_payment_date
         FROM credit_accounts
         WHERE tenant_id=$1 AND status='active' AND current_balance > 0
           AND (last_payment_date IS NULL OR last_payment_date < CURRENT_DATE - 30)
         ORDER BY current_balance DESC LIMIT 10`,
        [tid]
      ),
    ]);
    return { ...summary[0], overdue_accounts: overdue };
  }

  // ══════════════════════════════════════════════════════════════════════
  // PETTY CASH
  // ══════════════════════════════════════════════════════════════════════

  @Get('petty-cash')
  async getPettyCash(@Query('days') days: string, @Req() req: any) {
    const tid = req.user.tenant_id;
    const [transactions, balance] = await Promise.all([
      this.ds.query(
        `SELECT pc.*, u.full_name as created_by_name
         FROM petty_cash pc LEFT JOIN users u ON u.id=pc.created_by
         WHERE pc.tenant_id=$1 ORDER BY pc.txn_date DESC, pc.created_at DESC
         LIMIT $2`,
        [tid, parseInt(days) || 50]
      ),
      this.ds.query(
        `SELECT COALESCE(SUM(CASE WHEN txn_type='topup' THEN amount ELSE -amount END),0)::numeric(10,2) AS balance
         FROM petty_cash WHERE tenant_id=$1`,
        [tid]
      ),
    ]);
    return { balance: Number(balance[0]?.balance || 0), transactions };
  }

  @Post('petty-cash')
  async addPettyCash(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    // Calculate new balance
    const current = await this.ds.query(
      `SELECT COALESCE(SUM(CASE WHEN txn_type='topup' THEN amount ELSE -amount END),0) AS bal
       FROM petty_cash WHERE tenant_id=$1`,
      [tenant_id]
    );
    const currentBal = Number(current[0]?.bal || 0);
    const newBal = body.txn_type === 'topup'
      ? currentBal + Number(body.amount)
      : currentBal - Number(body.amount);

    if (body.txn_type === 'expense' && newBal < 0) {
      throw new Error(`Insufficient petty cash. Available: ₹${currentBal}`);
    }

    const r = await this.ds.query(
      `INSERT INTO petty_cash (tenant_id, txn_date, txn_type, amount, description, category, balance_after, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [tenant_id, body.txn_date || new Date().toISOString().split('T')[0],
       body.txn_type, body.amount, body.description,
       body.category || null, newBal, sub]
    );
    return { ...r[0], new_balance: newBal };
  }

  // ══════════════════════════════════════════════════════════════════════
  // BANK STATEMENT IMPORT
  // ══════════════════════════════════════════════════════════════════════

  @Get('bank-transactions')
  async getBankTransactions(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('unmatched') unmatched: string,
    @Req() req: any
  ) {
    const tid   = req.user.tenant_id;
    const start = from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end   = to   || new Date().toISOString().split('T')[0];

    let q = `SELECT * FROM bank_transactions WHERE tenant_id=$1 AND txn_date BETWEEN $2 AND $3`;
    if (unmatched === 'true') q += ` AND matched_type IS NULL`;
    q += ` ORDER BY txn_date DESC LIMIT 200`;

    return this.ds.query(q, [tid, start, end]);
  }

  @Post('bank-import')
  async importBankStatement(@Body() body: { transactions: any[] }, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    let imported = 0;
    let matched  = 0;

    for (const txn of body.transactions) {
      // Insert transaction
      const inserted = await this.ds.query(
        `INSERT INTO bank_transactions (tenant_id, txn_date, description, credit_amount, debit_amount, balance, reference_no, txn_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT DO NOTHING RETURNING id`,
        [tenant_id, txn.date, txn.description,
         txn.credit || 0, txn.debit || 0,
         txn.balance || null, txn.reference || null,
         this.inferTxnType(txn.description)]
      );
      if (!inserted.length) continue;
      imported++;

      const id = inserted[0].id;

      // Auto-match logic
      if (txn.credit > 0) {
        // Try to match with UPI sales
        const sale = await this.ds.query(
          `SELECT id FROM sales
           WHERE tenant_id=$1 AND payment_mode='upi' AND is_voided=false
           AND ABS(total_amount - $2) < 1
           AND DATE(created_at AT TIME ZONE 'Asia/Kolkata') BETWEEN $3::date - 2 AND $3::date + 2
           LIMIT 1`,
          [tenant_id, txn.credit, txn.date]
        );
        if (sale.length) {
          await this.ds.query(
            `UPDATE bank_transactions SET matched_type='sale', matched_id=$1, matched_at=NOW() WHERE id=$2`,
            [sale[0].id, id]
          );
          matched++;
          continue;
        }
      }

      if (txn.debit > 0) {
        // Try to match with expenses
        const expense = await this.ds.query(
          `SELECT id FROM expenses
           WHERE tenant_id=$1 AND ABS(amount - $2) < 1
           AND expense_date BETWEEN $3::date - 2 AND $3::date + 2
           LIMIT 1`,
          [tenant_id, txn.debit, txn.date]
        );
        if (expense.length) {
          await this.ds.query(
            `UPDATE bank_transactions SET matched_type='expense', matched_id=$1, matched_at=NOW() WHERE id=$2`,
            [expense[0].id, id]
          );
          matched++;
          continue;
        }

        // Try to match with salary payments
        const salary = await this.ds.query(
          `SELECT id FROM salary_payments
           WHERE tenant_id=$1 AND ABS(net_salary - $2) < 1
           AND payment_date BETWEEN $3::date - 3 AND $3::date + 3
           AND status='paid' LIMIT 1`,
          [tenant_id, txn.debit, txn.date]
        );
        if (salary.length) {
          await this.ds.query(
            `UPDATE bank_transactions SET matched_type='salary', matched_id=$1, matched_at=NOW() WHERE id=$2`,
            [salary[0].id, id]
          );
          matched++;
        }
      }
    }

    return {
      imported,
      matched,
      unmatched: imported - matched,
      message: `Imported ${imported} transactions, auto-matched ${matched}`,
    };
  }

  @Patch('bank-transactions/:id/match')
  async matchTransaction(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    await this.ds.query(
      `UPDATE bank_transactions SET matched_type=$1, matched_id=$2, matched_at=NOW()
       WHERE id=$3 AND tenant_id=$4`,
      [body.matched_type, body.matched_id || null, id, req.user.tenant_id]
    );
    return { updated: true };
  }

  private inferTxnType(description: string): string {
    const d = description.toUpperCase();
    if (d.includes('UPI') || d.includes('PHONEPE') || d.includes('GPAY') || d.includes('PAYTM')) return 'UPI';
    if (d.includes('NEFT') || d.includes('RTGS')) return 'NEFT';
    if (d.includes('IMPS')) return 'IMPS';
    if (d.includes('CHQ') || d.includes('CHEQUE')) return 'Cheque';
    if (d.includes('ATM') || d.includes('CASH')) return 'Cash';
    return 'Other';
  }

  // ══════════════════════════════════════════════════════════════════════
  // PURCHASE INVOICE MATCHING
  // ══════════════════════════════════════════════════════════════════════

  @Post('match-purchase-invoice')
  async matchPurchaseInvoice(@Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;

    // Find matching PO by supplier and approximate amount
    const matches = await this.ds.query(
      `SELECT po.id, po.po_number, po.supplier_name, po.total_amount,
              po.status, po.created_at
       FROM purchase_orders po
       WHERE po.tenant_id=$1
         AND po.supplier_name ILIKE $2
         AND po.payment_status != 'paid'
       ORDER BY po.created_at DESC LIMIT 5`,
      [tenant_id, `%${body.supplier_name}%`]
    );

    if (body.po_id) {
      // Manual match — update PO with invoice details
      await this.ds.query(
        `UPDATE purchase_orders SET
           total_amount     = $1,
           payment_status   = CASE WHEN $1 <= COALESCE(paid_amount,0) THEN 'paid' ELSE 'unpaid' END,
           due_date         = $2,
           credit_days      = $3
         WHERE id=$4 AND tenant_id=$5`,
        [body.invoice_amount, body.due_date || null,
         body.credit_days || 0, body.po_id, tenant_id]
      );

      // Auto-create supplier ledger entry
      await this.ds.query(
        `INSERT INTO supplier_ledger (tenant_id, supplier_name, entry_date, entry_type, amount, reference_no, due_date, notes, created_by)
         VALUES ($1,$2,$3,'invoice',$4,$5,$6,$7,$8)`,
        [tenant_id, body.supplier_name,
         body.invoice_date || new Date().toISOString().split('T')[0],
         body.invoice_amount, body.invoice_number || null,
         body.due_date || null,
         `Auto from PO match - ${body.invoice_number}`,
         sub]
      );

      return { matched: true, message: 'Invoice matched and supplier payable created' };
    }

    return { matched: false, possible_matches: matches };
  }
}
