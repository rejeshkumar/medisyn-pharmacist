import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get owner dashboard KPIs' })
  getDashboard(@Request() req) {
    return this.reportsService.getDashboard(req.tenantId);
  }

  @Get('daily-sales')
  @ApiOperation({ summary: 'Get daily sales summary' })
  @ApiQuery({ name: 'date', required: false })
  getDailySales(@Request() req, @Query('date') date?: string) {
    return this.reportsService.getDailySales(req.tenantId, date);
  }

  @Get('period-sales')
  @ApiOperation({ summary: 'Get sales for a date range' })
  @ApiQuery({ name: 'from', required: true })
  @ApiQuery({ name: 'to', required: true })
  getPeriodSales(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getPeriodSales(req.tenantId, from, to);
  }

  @Get('top-medicines')
  @ApiOperation({ summary: 'Get top selling medicines' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  getTopMedicines(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.getTopMedicines(req.tenantId, from, to);
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Get low stock medicines' })
  getLowStock(@Request() req) {
    return this.reportsService.getLowStockReport(req.tenantId);
  }

  @Get('near-expiry')
  @ApiOperation({ summary: 'Get near expiry batches' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getNearExpiry(@Request() req, @Query('days') days?: number) {
    return this.reportsService.getNearExpiryReport(req.tenantId, days ? Number(days) : 90);
  }

  @Get('stock-valuation')
  @ApiOperation({ summary: 'Get stock valuation report' })
  getStockValuation(@Request() req) {
    return this.reportsService.getStockValuation(req.tenantId);
  }

  @Get('export/sales')
  @ApiOperation({ summary: 'Export sales report to Excel' })
  async exportSales(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.reportsService.exportSalesToExcel(req.tenantId, from, to);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=sales-report-${from}-to-${to}.xlsx`);
    res.send(buffer);
  }
}
