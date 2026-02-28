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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Stock')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
    @Query('search') search?: string,
    @Query('expiry_days') expiryDays?: number,
    @Query('low_stock') lowStock?: boolean,
    @Query('schedule_class') scheduleClass?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('molecule') molecule?: string,
    @Query('category') category?: string,
  ) {
    return this.stockService.getStockList({
      search,
      expiryDays: expiryDays ? Number(expiryDays) : undefined,
      lowStock: lowStock === true || lowStock === ('true' as any),
      scheduleClass,
      supplierId,
      molecule,
      category,
    });
  }

  @Get('alerts/low-stock')
  @ApiOperation({ summary: 'Get low stock alerts' })
  getLowStockAlerts(@Query('threshold') threshold?: number) {
    return this.stockService.getLowStockAlerts(threshold ? Number(threshold) : 10);
  }

  @Get('alerts/near-expiry')
  @ApiOperation({ summary: 'Get near expiry alerts' })
  getNearExpiryAlerts(@Query('days') days?: number) {
    return this.stockService.getNearExpiryAlerts(days ? Number(days) : 90);
  }

  @Get('suppliers')
  @ApiOperation({ summary: 'List all suppliers' })
  getSuppliers() {
    return this.stockService.getSuppliers();
  }

  @Post('suppliers')
  @ApiOperation({ summary: 'Create a supplier' })
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.stockService.createSupplier(dto);
  }

  @Get(':medicine_id/batches')
  @ApiOperation({ summary: 'Get batches for a medicine' })
  getBatches(@Param('medicine_id') medicineId: string) {
    return this.stockService.getBatchesForMedicine(medicineId);
  }

  @Get(':medicine_id/best-batch')
  @ApiOperation({ summary: 'Get best batch (nearest safe expiry)' })
  getBestBatch(@Param('medicine_id') medicineId: string) {
    return this.stockService.getBestBatch(medicineId);
  }

  @Post('purchase')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Add stock via purchase invoice' })
  addPurchase(@Body() dto: AddPurchaseDto, @Request() req) {
    return this.stockService.addPurchase(dto, req.user.id);
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Adjust stock (expiry/damage/sample)' })
  adjustStock(@Body() dto: AdjustStockDto, @Request() req) {
    return this.stockService.adjustStock(dto, req.user.id);
  }
}
