import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { BillingService } from './billing.service';
import { VipTier } from './vip-tier.entity';
import { ServiceCategory } from './service-rate.entity';
import { BillPaymentMode } from './clinic-bill.entity';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ── VIP tiers ────────────────────────────────────────────────
  @Get('vip-tiers')
  getVipTiers(@Req() req: any) {
    return this.billing.getVipTiers(req.user.tenant_id);
  }

  @Put('vip-tiers/:tier')
  updateVipTier(
    @Param('tier') tier: VipTier,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.billing.updateVipTier(req.user.tenant_id, tier, body);
  }

  // ── Doctor rates ─────────────────────────────────────────────
  @Get('doctor-rates')
  getDoctorRates(@Req() req: any) {
    return this.billing.getDoctorRates(req.user.tenant_id);
  }

  @Put('doctor-rates/:doctorId')
  upsertDoctorRate(
    @Param('doctorId') doctorId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.billing.upsertDoctorRate(req.user.tenant_id, doctorId, body);
  }

  @Get('doctor-rates/:doctorId/for-patient/:patientId')
  getDoctorRateForPatient(
    @Param('doctorId') doctorId: string,
    @Param('patientId') patientId: string,
    @Query('visit_type') visitType: string,
    @Req() req: any,
  ) {
    return this.billing.getDoctorRateForPatient(
      req.user.tenant_id, doctorId, patientId, visitType ?? 'new',
    );
  }

  // ── Service rates ─────────────────────────────────────────────
  @Get('service-rates')
  getServiceRates(
    @Query('category') category: ServiceCategory,
    @Req() req: any,
  ) {
    return this.billing.getServiceRates(req.user.tenant_id, category);
  }

  @Post('service-rates')
  createServiceRate(@Body() body: any, @Req() req: any) {
    return this.billing.upsertServiceRate(req.user.tenant_id, undefined, {
      ...body, tenant_id: req.user.tenant_id,
    });
  }

  @Put('service-rates/:id')
  updateServiceRate(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.billing.upsertServiceRate(req.user.tenant_id, id, body);
  }

  @Delete('service-rates/:id')
  deleteServiceRate(@Param('id') id: string, @Req() req: any) {
    return this.billing.deleteServiceRate(req.user.tenant_id, id);
  }

  // ── Bills ────────────────────────────────────────────────────
  @Post('clinic-bills/preview')
  previewBill(@Body() body: any, @Req() req: any) {
    return this.billing.previewBill(
      req.user.tenant_id,
      body.patient_id,
      body.items ?? [],
      body.extra_discount_pct ?? 0,
      body.extra_discount_amt ?? 0,
    );
  }

  @Post('clinic-bills')
  createBill(@Body() body: any, @Req() req: any) {
    return this.billing.createBill(body, req.user.tenant_id, req.user.sub);
  }

  @Get('clinic-bills')
  listBills(@Query() query: any, @Req() req: any) {
    return this.billing.listBills(req.user.tenant_id, {
      date:      query.date,
      patientId: query.patient_id,
      status:    query.status,
      page:      query.page  ? Number(query.page)  : 1,
      limit:     query.limit ? Number(query.limit) : 50,
    });
  }

  @Get('clinic-bills/:id')
  getBill(@Param('id') id: string, @Req() req: any) {
    return this.billing.getBill(id, req.user.tenant_id);
  }

  // ── Patient VIP status ───────────────────────────────────────
  @Get('patients/:patientId/vip')
  getPatientVip(@Param('patientId') patientId: string, @Req() req: any) {
    return this.billing.getVipDiscounts(req.user.tenant_id, patientId);
  }

  @Patch('patients/:patientId/vip')
  updatePatientVip(
    @Param('patientId') patientId: string,
    @Body() body: { vip_tier: VipTier | null; vip_valid_until: string; vip_since: string },
    @Req() req: any,
  ) {
    return this.billing['dataSource'].query(
      `UPDATE patients
       SET vip_tier = $1, vip_valid_until = $2, vip_since = $3
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, vip_tier, vip_valid_until, vip_since`,
      [body.vip_tier || null, body.vip_valid_until || null, body.vip_since || null,
       patientId, req.user.tenant_id],
    ).then((rows: any[]) => rows[0]);
  }

  @Get('clinic-bills/summary')
  async getBillSummary(@Query('date') date: string, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const result = await this.billing['dataSource'].query(
      `SELECT
         COUNT(*)::int                                                  AS total_bills,
         COALESCE(SUM(CASE WHEN status IN ('confirmed','paid')
                     THEN total_amount END), 0)                        AS total_collected,
         COUNT(CASE WHEN status = 'draft' THEN 1 END)::int             AS pending_count,
         COALESCE(SUM(vip_discount_amount + extra_discount_amt), 0)    AS total_discounts
       FROM clinic_bills
       WHERE tenant_id = $1
         AND ($2::date IS NULL OR DATE(created_at) = $2::date)`,
      [tenantId, date || null],
    );
    return result[0] ?? { total_bills: 0, total_collected: 0, pending_count: 0, total_discounts: 0 };
  }
}
