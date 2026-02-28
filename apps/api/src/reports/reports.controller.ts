import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get owner dashboard KPIs' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('daily-sales')
  @ApiOperation({ summary: 'Get daily sales summary' })
  @ApiQuery({ name: 'date', required: false })
  getDailySales(@Query('date') date?: string) {
    return this.reportsService.getDailySales(date);
  }

  @Get('period-sales')
  @ApiOperation({ summary: 'Get sales for a date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getPeriodSales(@Query('from') from: string, @Query('to') to: string) {
    return this.reportsService.getPeriodSales(from, to);
  }

  @Get('top-medicines')
  @ApiOperation({ summary: 'Get top selling medicines' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getTopMedicines(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getTopMedicines(from, to);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock medicines' })
  getLowStock() {
    return this.reportsService.getLowStockReport();
  }

  @Get('near-expiry')
  @ApiOperation({ summary: 'Get near expiry batches' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getNearExpiry(@Query('days') days?: number) {
    return this.reportsService.getNearExpiryReport(days ? Number(days) : 90);
  }

  @Get('stock-valuation')
  @ApiOperation({ summary: 'Get stock valuation report' })
  getStockValuation() {
    return this.reportsService.getStockValuation();
  }

  @Get('export/sales')
  @ApiOperation({ summary: 'Export sales report to Excel' })
  async exportSales(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportSalesToExcel(from, to);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=sales-report-${from}-to-${to}.xlsx`,
    );
    res.send(buffer);
  }
}
