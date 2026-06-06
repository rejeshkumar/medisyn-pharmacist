import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@Controller('report')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('gst-summary')
  getGstSummary(@Query('month') month: string, @Query('year') year: string, @Req() req) {
    return this.reportsService.getGstSummary(
      req.user.tenant_id,
      parseInt(month) || new Date().getMonth() + 1,
      parseInt(year) || new Date().getFullYear(),
    );
  }

  @Get('schedule-h-register')
  getScheduleHRegister(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('schedule') schedule: string,
    @Req() req,
  ) {
    return this.reportsService.getScheduleHRegister(req.user.tenant_id, from, to, schedule || 'H');
  }

  @Get('ar-aging')
  getArAging(@Query('as_of') asOf: string, @Req() req) {
    return this.reportsService.getArAging(req.user.tenant_id, asOf);
  }

  @Get('profit-loss')
  getProfitLoss(@Query('month') month: string, @Query('year') year: string, @Req() req) {
    return this.reportsService.getProfitLoss(
      req.user.tenant_id,
      parseInt(month) || new Date().getMonth() + 1,
      parseInt(year) || new Date().getFullYear(),
    );
  }

  @Get('stock-ledger')
  getStockLedger(
    @Query('medicine_id') medicineId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Req() req,
  ) {
    return this.reportsService.getStockLedger(req.user.tenant_id, medicineId, from, to);
  }
}
