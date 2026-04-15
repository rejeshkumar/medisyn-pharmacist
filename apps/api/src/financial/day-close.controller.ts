// Place at: apps/api/src/financial/day-close.controller.ts
import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('financial/day-close')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DayCloseController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get(':date')
  async getDayClose(@Param('date') date: string, @Req() req: any) {
    const { tenant_id } = req.user;
    let [record] = await this.ds.query(
      `SELECT * FROM day_close WHERE tenant_id = $1 AND close_date = $2`,
      [tenant_id, date]
    );
    if (!record) {
      const [prev] = await this.ds.query(
        `SELECT closing_cash, closing_bank FROM day_close
         WHERE tenant_id = $1 AND close_date < $2 AND status = 'owner_approved'
         ORDER BY close_date DESC LIMIT 1`,
        [tenant_id, date]
      );
      const [created] = await this.ds.query(
        `INSERT INTO day_close (tenant_id, close_date, opening_cash, opening_bank, status)
         VALUES ($1, $2, $3, $4, 'open')
         ON CONFLICT (tenant_id, close_date) DO UPDATE SET updated_at = NOW()
         RETURNING *`,
        [tenant_id, date, prev?.closing_cash || 0, prev?.closing_bank || 0]
      );
      record = created;
    }
    const [sys] = await this.ds.query(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_mode='cash' THEN total_amount END),0)::numeric AS system_cash,
         COALESCE(SUM(CASE WHEN payment_mode='upi' THEN total_amount END),0)::numeric AS system_upi,
         COALESCE(SUM(total_amount),0)::numeric AS system_total,
         COUNT(*)::int AS bill_count
       FROM sales WHERE tenant_id=$1
         AND DATE(created_at + INTERVAL '5 hours 30 minutes')=$2
         AND is_voided=false`,
      [tenant_id, date]
    );
    const [otherInc] = await this.ds.query(
      `SELECT COALESCE(SUM(CASE WHEN payment_mode='cash' THEN amount END),0)::numeric AS other_cash,
              COALESCE(SUM(CASE WHEN payment_mode='upi' THEN amount END),0)::numeric AS other_upi
       FROM other_income WHERE tenant_id=$1 AND income_date=$2`,
      [tenant_id, date]
    ).catch(() => [{ other_cash: 0, other_upi: 0 }]);
    const [exp] = await this.ds.query(
      `SELECT COALESCE(SUM(amount),0)::numeric AS total_expenses FROM expenses
       WHERE tenant_id=$1 AND expense_date=$2`,
      [tenant_id, date]
    ).catch(() => [{ total_expenses: 0 }]);
    const [bankUpi] = await this.ds.query(
      `SELECT COALESCE(SUM(credit_amount),0)::numeric AS bank_upi_total FROM bank_transactions
       WHERE tenant_id=$1 AND txn_date=$2 AND txn_type='upi'`,
      [tenant_id, date]
    ).catch(() => [{ bank_upi_total: 0 }]);
    return { ...record,
      system_cash: Number(sys?.system_cash||0), system_upi: Number(sys?.system_upi||0),
      system_total: Number(sys?.system_total||0), bill_count: Number(sys?.bill_count||0),
      other_cash: Number(otherInc?.other_cash||0), other_upi: Number(otherInc?.other_upi||0),
      total_expenses: Number(exp?.total_expenses||0), bank_upi_total: Number(bankUpi?.bank_upi_total||0),
    };
  }

  @Post(':date/pharmacist-submit')
  async pharmacistSubmit(@Param('date') date: string, @Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    await this.ds.query(
      `INSERT INTO day_close (tenant_id, close_date, status) VALUES ($1,$2,'open')
       ON CONFLICT (tenant_id, close_date) DO NOTHING`, [tenant_id, date]);
    const [r] = await this.ds.query(
      `UPDATE day_close SET pharmacist_cash_counted=$1, pharmacist_upi_counted=$2,
       pharmacist_notes=$3, pharmacist_id=$4, pharmacist_submitted_at=NOW(),
       status=CASE WHEN status='open' THEN 'pharmacist_submitted' ELSE status END, updated_at=NOW()
       WHERE tenant_id=$5 AND close_date=$6 RETURNING *`,
      [body.cash_counted, body.upi_counted, body.notes||null, sub, tenant_id, date]);
    return { success: true, record: r };
  }

  @Post(':date/receptionist-submit')
  async receptionistSubmit(@Param('date') date: string, @Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    await this.ds.query(
      `INSERT INTO day_close (tenant_id, close_date, status) VALUES ($1,$2,'open')
       ON CONFLICT (tenant_id, close_date) DO NOTHING`, [tenant_id, date]);
    const [r] = await this.ds.query(
      `UPDATE day_close SET receptionist_cash_counted=$1, receptionist_upi_counted=$2,
       receptionist_notes=$3, receptionist_id=$4, receptionist_submitted_at=NOW(), updated_at=NOW()
       WHERE tenant_id=$5 AND close_date=$6 RETURNING *`,
      [body.cash_counted, body.upi_counted, body.notes||null, sub, tenant_id, date]);
    return { success: true, record: r };
  }

  @Post(':date/owner-approve')
  async ownerApprove(@Param('date') date: string, @Body() body: any, @Req() req: any) {
    const { tenant_id, sub } = req.user;
    const [sysUpi] = await this.ds.query(
      `SELECT COALESCE(SUM(total_amount),0)::numeric AS system_upi FROM sales
       WHERE tenant_id=$1 AND DATE(created_at + INTERVAL '5 hours 30 minutes')=$2
       AND payment_mode='upi' AND is_voided=false`, [tenant_id, date]);
    const matched = Math.abs((body.bank_upi_credit||0) - Number(sysUpi?.system_upi||0)) < 5;
    const [r] = await this.ds.query(
      `UPDATE day_close SET bank_upi_credit=$1, bank_upi_matched=$2,
       cash_deposited_to_bank=$3, closing_cash=$4, closing_bank=$5,
       owner_id=$6, owner_notes=$7, owner_approved_at=NOW(), status='owner_approved', updated_at=NOW()
       WHERE tenant_id=$8 AND close_date=$9 RETURNING *`,
      [body.bank_upi_credit||0, matched, body.cash_deposited_to_bank||0,
       body.closing_cash||0, body.closing_bank||0,
       sub, body.owner_notes||null, tenant_id, date]);
    return { success: true, record: r, bank_upi_matched: matched };
  }

  @Get('')
  async getHistory(@Query('days') days = '30', @Req() req: any) {
    const { tenant_id } = req.user;
    return this.ds.query(
      `SELECT dc.*,
         COALESCE(SUM(CASE WHEN s.payment_mode='cash' THEN s.total_amount END),0)::numeric AS system_cash,
         COALESCE(SUM(CASE WHEN s.payment_mode='upi' THEN s.total_amount END),0)::numeric AS system_upi,
         COALESCE(SUM(s.total_amount),0)::numeric AS system_total,
         COUNT(s.id)::int AS bill_count
       FROM day_close dc
       LEFT JOIN sales s ON s.tenant_id=dc.tenant_id
         AND DATE(s.created_at + INTERVAL '5 hours 30 minutes')=dc.close_date
         AND s.is_voided=false
       WHERE dc.tenant_id=$1 AND dc.close_date >= CURRENT_DATE-$2::int
       GROUP BY dc.id
       ORDER BY dc.close_date DESC`,
      [tenant_id, Number(days)]);
  }
}
