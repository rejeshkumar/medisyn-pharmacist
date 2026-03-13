import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StockService } from './stock.service';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(private stockService: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Get stock list with filters' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'expiry_days', required: false, type: Number })
  @ApiQuery({ name: 'low_stock', required: false, type: Boolean })
  @ApiQuery({ name: 'schedule_class', required: false })
  getStockList(
    @Request() req,
    @Query('search') search?: string,
    @Query('expiry_days') expiryDays?: number,
    @Query('low_stock') lowStock?: boolean,
    @Query('schedule_class') scheduleClass?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('molecule') molecule?: string,
    @Query('category') category?: string,
  ) {
    return this.stockService.getStockList(req.tenantId, {
      search,
      expiryDays: expiryDays ? Number(expiryDays) : undefined,
      lowStock:   lowStock === true || lowStock === ('true' as any),
      scheduleClass,
      supplierId,
      molecule,
      category,
    });
  }

  @Get('alerts/low-stock')
  @ApiOperation({ summary: 'Get low stock alerts' })
  getLowStockAlerts(@Request() req, @Query('threshold') threshold?: number) {
    return this.stockService.getLowStockAlerts(req.tenantId, threshold ? Number(threshold) : 10);
  }

  @Get('alerts/near-expiry')
  @ApiOperation({ summary: 'Get near expiry alerts' })
  getNearExpiryAlerts(@Request() req, @Query('days') days?: number) {
    return this.stockService.getNearExpiryAlerts(req.tenantId, days ? Number(days) : 90);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List all suppliers' })
  getSuppliers(@Request() req) {
    return this.stockService.getSuppliers(req.tenantId);
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create a supplier' })
  createSupplier(@Body() dto: CreateSupplierDto, @Request() req) {
    return this.stockService.createSupplier(dto, req.user);
  }

  @Get(':medicine_id/batches')
  @ApiOperation({ summary: 'Get batches for a medicine' })
  getBatches(@Param('medicine_id') medicineId: string, @Request() req) {
    return this.stockService.getBatchesForMedicine(medicineId, req.tenantId);
  }

  @Get(':medicine_id/best-batch')
  @ApiOperation({ summary: 'Get best batch (nearest safe expiry)' })
  getBestBatch(@Param('medicine_id') medicineId: string, @Request() req) {
    return this.stockService.getBestBatch(medicineId, req.tenantId);
  }

  @Post('purchase')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Add stock via purchase invoice' })
  addPurchase(@Body() dto: AddPurchaseDto, @Request() req) {
    return this.stockService.addPurchase(dto, req.user);
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Adjust stock (expiry/damage/sample)' })
  adjustStock(@Body() dto: AdjustStockDto, @Request() req) {
    return this.stockService.adjustStock(dto, req.user);
  }

  @Get('expiring')
  getExpiring(@Req() req: any, @Query('days') days?: string) {
    return this.stockService.getExpiring(req.user.tenant_id, parseInt(days || '60'));
  }

  @Get(':medicineId/batches')
  getBatches(@Param('medicineId') medicineId: string, @Req() req: any) {
    return this.stockService.getBatchesForMedicine(medicineId, req.user.tenant_id);
  }
}
