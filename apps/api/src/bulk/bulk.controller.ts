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
import { VendorCsvNormalizerService } from './vendor-csv-normalizer.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Bulk Upload')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bulk')
export class BulkController {
  constructor(
    private bulkService: BulkService,
    private csvNormalizer: VendorCsvNormalizerService,
  ) {}

  @Get('template/medicines')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Download medicine master import template' })
  async getMedicineTemplate(@Res() res: Response) {
    const buffer = await this.bulkService.getMedicineTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=medicine-import-template.xlsx');
    res.send(buffer);
  }

  @Get('template/stock')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Download stock batch import template' })
  async getStockTemplate(@Res() res: Response) {
    const buffer = await this.bulkService.getStockTemplate();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock-import-template.xlsx');
    res.send(buffer);
  }

  @Post('medicines/import')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import medicine master from Excel' })
  importMedicines(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.bulkService.importMedicines(file.path, file.originalname, req.user.id);
  }

  @Post('stock/import')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Import stock batches from Excel' })
  importStock(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.bulkService.importStock(file.path, file.originalname, req.user.id);
  }

  @Post('invoice/parse')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Parse a supplier PDF invoice and extract medicine/stock data' })
  parseInvoice(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');
    return this.bulkService.parseInvoicePdf(file.path);
  }

  @Post('invoice/import')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Import reviewed invoice items into stock' })
  importInvoice(@Body() body: any, @Request() req) {
    const { items, supplier, invoiceNo, po_id } = body;
    return this.bulkService.importInvoiceItems(items, supplier, invoiceNo, req.user.id, po_id);
  }

  @Post('vendor-csv/normalize')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Normalize vendor CSV to standard stock import format',
    description: 'Upload any vendor CSV (Inter Link, MediWMS) — auto-detects format and returns normalized records',
  })
  async normalizeVendorCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file uploaded');

    // Try buffer first (memory storage), fall back to disk path
    const csvContent = file.buffer
      ? file.buffer.toString('utf-8')
      : require('fs').readFileSync(file.path, 'utf-8');

    const result = await this.csvNormalizer.normalize(csvContent);

    return {
      success: result.records.length > 0 && result.errors.length === 0,
      format: result.format,
      recordCount: result.records.length,
      errors: result.errors,
      records: result.records,
      message: result.errors.length === 0
        ? `Detected ${result.format} format. ${result.records.length} records ready for import.`
        : `Detected ${result.format} format. ${result.errors.length} validation errors.`,
    };
  }

  @Post('vendor-csv/import')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({
    summary: 'Import normalized vendor CSV records directly into stock',
    description: 'Takes the records from /vendor-csv/normalize and imports them into stock_batches',
  })
  async importVendorCsvRecords(@Body() body: any, @Request() req) {
    const { records } = body;
    if (!records || !Array.isArray(records) || records.length === 0) {
      return { success: false, message: 'No records provided' };
    }

    // Convert normalized records to invoice items format and use existing importInvoiceItems
    const items = records.map((r: any) => ({
      medicineName: r.brand_name,
      batchNo: r.batch_no,
      expiry: r.expiry,
      qty: r.quantity,
      purchasePrice: r.purchase_price,
      mrp: r.sale_rate,
      gstPercent: 5,
    }));

    const supplierName = records[0]?.supplier || 'Unknown Supplier';
    return this.bulkService.importInvoiceItems(items, supplierName, `Vendor CSV: ${supplierName}`, req.user.id);
  }

  @Get('logs')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'Get bulk activity logs' })
  getLogs(@Request() req) {
    return this.bulkService.getLogs();
  }
}
