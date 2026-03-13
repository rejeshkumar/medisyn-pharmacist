import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Medicines')
@ApiBearerAuth()
@Controller('medicines')
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) {}

  @Get()
  @ApiOperation({ summary: 'Search medicines by brand/molecule' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'schedule_class', required: false })
  @ApiQuery({ name: 'with_stock', required: false, description: 'Include real-time stock availability (for prescription autocomplete)' })
  findAll(
    @Request() req,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('schedule_class') scheduleClass?: string,
    @Query('with_stock') withStock?: string,
  ) {
    return this.medicinesService.findAll(req.tenantId, search, category, scheduleClass, withStock === 'true');
  }

  @Get('with-stock')
  @ApiOperation({ summary: 'Get all medicines with their available stock' })
  getWithStock(@Request() req) {
    return this.medicinesService.getWithStock(req.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.medicinesService.findOne(id, req.tenantId);
  }

  @Get(':id/substitutes')
  @ApiOperation({ summary: 'Get substitute medicines for a given medicine' })
  getSubstitutes(@Param('id') id: string, @Request() req) {
    return this.medicinesService.getSubstitutes(id, req.tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Add a new medicine to master' })
  create(@Body() dto: CreateMedicineDto, @Request() req) {
    return this.medicinesService.create(dto, req.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Update medicine details' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto, @Request() req) {
    return this.medicinesService.update(id, dto, req.user);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate medicine (Owner only)' })
  deactivate(@Param('id') id: string, @Request() req) {
    return this.medicinesService.deactivate(id, req.user);
  }

  @Get('barcode-mappings')
  getBarcodeMappings(@Req() req: any) {
    return this.medicinesService.getBarcodeMappings(req.user.tenant_id);
  }

  @Get('barcode/:code')
  lookupBarcode(@Param('code') code: string, @Req() req: any) {
    return this.medicinesService.lookupBarcode(decodeURIComponent(code), req.user.tenant_id);
  }

  @Post('barcode-mappings')
  createBarcodeMapping(@Body() body: { barcode: string; medicine_id: string }, @Req() req: any) {
    return this.medicinesService.createBarcodeMapping(body, {
      id: req.user.sub, full_name: req.user.name,
      role: req.user.role, tenant_id: req.user.tenant_id,
    });
  }
}
