import { Controller, Get, Post, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  // GET /payments/bill/:queueId — get bill summary (consultation + medicine)
  @Get('bill/:queueId')
  getBill(@Param('queueId') queueId: string, @Req() req: any) {
    return this.paymentService.getBillSummary(queueId, req.user.tenant_id);
  }

  // POST /payments — record a payment
  @Post()
  record(@Body() body: any, @Req() req: any) {
    return this.paymentService.recordPayment(body, {
      id:        req.user.sub,
      full_name: req.user.name,
      role:      req.user.role,
      tenant_id: req.user.tenant_id,
    });
  }

  // GET /payments/queue/:queueId — get existing payment for a queue entry
  @Get('queue/:queueId')
  getByQueue(@Param('queueId') queueId: string, @Req() req: any) {
    return this.paymentService.getByQueue(queueId, req.user.tenant_id);
  }

  // GET /payments — list all payments
  @Get()
  list(@Query() query: any, @Req() req: any) {
    return this.paymentService.list(req.user.tenant_id, {
      date:  query.date,
      page:  query.page  ? parseInt(query.page)  : 1,
      limit: query.limit ? parseInt(query.limit) : 50,
    });
  }
}
