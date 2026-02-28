import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Medicines')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medicines')
export class MedicinesController {
  constructor(private medicinesService: MedicinesService) {}

  @Get()
  @ApiOperation({ summary: 'Search medicines by brand/molecule' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'schedule_class', required: false })
  findAll(
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('schedule_class') scheduleClass?: string,
  ) {
    return this.medicinesService.findAll(search, category, scheduleClass);
  }

  @Get('with-stock')
  @ApiOperation({ summary: 'Get all medicines with their available stock' })
  getWithStock() {
    return this.medicinesService.getWithStock();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get medicine by ID' })
  findOne(@Param('id') id: string) {
    return this.medicinesService.findOne(id);
  }

  @Get(':id/substitutes')
  @ApiOperation({ summary: 'Get substitute medicines for a given medicine' })
  getSubstitutes(@Param('id') id: string) {
    return this.medicinesService.getSubstitutes(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Add a new medicine to master' })
  create(@Body() dto: CreateMedicineDto) {
    return this.medicinesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Update medicine details' })
  update(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.medicinesService.update(id, dto);
  }

  @Patch(':id/deactivate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate medicine (Owner only)' })
  deactivate(@Param('id') id: string) {
    return this.medicinesService.deactivate(id);
  }
}
