import { Controller, Get, Post, Param, Body, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PendingReceptionService } from './pending-reception.service';
import { SalesService } from './sales.service';

@ApiTags('Pending Reception')
@ApiBearerAuth()
@Controller('sales/pending-reception')
export class PendingReceptionController {
  constructor(
    private readonly pending: PendingReceptionService,
    private readonly sales: SalesService,
  ) {}

  @Post('route')
  @ApiOperation({ summary: 'Route dispensed medicines to reception for billing' })
  route(@Body() dto: any, @Request() req) {
    return this.pending.routeToReception(dto, req.user.sub, req.user.tenant_id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all pending reception bills' })
  getPending(@Request() req) {
    return this.pending.getPending(req.user.tenant_id);
  }

  @Post(':id/collect')
  @ApiOperation({ summary: 'Collect payment and create final bill' })
  async collect(
    @Param('id') id: string,
    @Body() body: { payment_mode: string; amount_paid?: number },
    @Request() req,
  ) {
    const pendingData = await this.pending.collectPayment(
      id, body.payment_mode, req.user.sub, req.user.tenant_id,
    );

    const sale = await this.sales.createSale({
      customer_name: pendingData.patient_name,
      patient_id: pendingData.patient_id,
      doctor_name: pendingData.doctor_name,
      referring_doctor: pendingData.referring_doctor,
      payment_mode: body.payment_mode,
      amount_paid: body.amount_paid || pendingData.total_amount,
      billing_route: 'reception',
      pending_reception_id: pendingData.pending_id,
      items: pendingData.cart_data.map((i: any) => ({
        medicine_id: i.medicine_id,
        batch_id: i.batch_id,
        qty: i.qty,
        rate: i.rate,
        gst_percent: i.gst_percent,
        discount_percent: i.line_discount_pct,
        is_substituted: i.is_substituted,
        original_medicine_id: i.original_medicine_id,
      })),
      discount_amount: pendingData.discount_amount,
      compliance_data: pendingData.compliance_data,
    } as any, req.user);

    return sale;
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending reception bill' })
  cancel(@Param('id') id: string, @Request() req) {
    return this.pending.cancel(id, req.user.tenant_id);
  }
}
