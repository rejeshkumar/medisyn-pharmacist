import { Controller, Get, Post, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ConsultationBillService } from './consultation-bill.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../auth/tenant.guard';

@Controller('consultation-bills')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ConsultationBillController {
  constructor(private readonly svc: ConsultationBillService) {}

  @Get('today')
  getTodayAll(@Req() req: any) {
    return this.svc.getTodayAll(req.tenantId);
  }

  @Get('today/pending')
  getPendingToday(@Req() req: any) {
    return this.svc.getPendingToday(req.tenantId);
  }

  @Get('today/summary')
  getTodaySummary(@Req() req: any) {
    return this.svc.getTodaySummary(req.tenantId);
  }

  @Get('queue/:queueId')
  getByQueue(@Param('queueId') queueId: string, @Req() req: any) {
    return this.svc.getByQueue(queueId, req.tenantId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.svc.getById(id, req.tenantId);
  }

  @Patch(':id/pay')
  collectPayment(
    @Param('id') id: string,
    @Body() body: { amount_paid: number; payment_mode: string; discount_amount?: number; notes?: string },
    @Req() req: any,
  ) {
    return this.svc.collectPayment(id, req.tenantId, body, req.user);
  }

  @Patch(':id/waive')
  waive(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Req() req: any,
  ) {
    return this.svc.waive(id, req.tenantId, body.reason, req.user);
  }
}
