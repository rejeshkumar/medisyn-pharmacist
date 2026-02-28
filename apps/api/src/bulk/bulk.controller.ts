import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { BulkService } from './bulk.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Bulk Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.OWNER)
@Controller('bulk')
export class BulkController {
  constructor(private bulkService: BulkService) {}

  @Get('template/medicines')
  @ApiOperation({ summary: 'Download medicine master import template' })
  async getMedicineTemplate(@Res() res: Response) {
    const buffer = await this.bulkService.getMedicineTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=medicine-import-template.xlsx');
    res.send(buffer);
  }

  @Get('template/stock')
  @ApiOperation({ summary: 'Download stock batch import template' })
  async getStockTemplate(@Res() res: Response) {
    const buffer = await this.bulkService.getStockTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock-import-template.xlsx');
    res.send(buffer);
  }

  @Post('medicines/import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import medicine master from Excel' })
  importMedicines(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.bulkService.importMedicines(file.path, file.originalname, req.user.id);
  }

  @Post('stock/import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import stock batches from Excel' })
  importStock(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.bulkService.importStock(file.path, file.originalname, req.user.id);
  }

  @Post('invoice/parse')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Parse a supplier PDF invoice and extract medicine/stock data' })
  parseInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    return this.bulkService.parseInvoicePdf(file.path);
  }

  @Post('invoice/import')
  @ApiOperation({ summary: 'Import reviewed invoice items into stock' })
  importInvoice(@Body() body: any, @Request() req) {
    const { items, supplier, invoiceNo } = body;
    return this.bulkService.importInvoiceItems(items, supplier, invoiceNo, req.user.id);
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get bulk activity logs' })
  getLogs(@Request() req) {
    return this.bulkService.getLogs();
  }
}
