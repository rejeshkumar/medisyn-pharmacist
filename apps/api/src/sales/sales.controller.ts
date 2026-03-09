import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { UseGuards } from '@nestjs/common';

@ApiTags('Sales')
@ApiBearerAuth()
@Controller('sales')
export class SalesController {
  constructor(private salesService: SalesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new bill / sale' })
  create(@Body() dto: CreateSaleDto, @Request() req) {
    return this.salesService.createSale(dto, req.user);
  }

  @Get()
  @ApiOperation({ summary: 'List sales with optional date filter' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
  ) {
    return this.salesService.findAll(req.tenantId, from, to, search);
  }

  @Get('bill/:billNumber')
  @ApiOperation({ summary: 'Get sale by bill number' })
  findByBillNumber(@Param('billNumber') billNumber: string, @Request() req) {
    return this.salesService.findByBillNumber(billNumber, req.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get sale details by ID' })
  findOne(@Param('id') id: string, @Request() req) {
    return this.salesService.findOne(id, req.tenantId);
  }

  @Post(':id/void')
  @UseGuards(RolesGuard)
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Void a bill (Owner only)' })
  void(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req,
  ) {
    return this.salesService.voidSale(id, body.reason, req.user);
  }
}
