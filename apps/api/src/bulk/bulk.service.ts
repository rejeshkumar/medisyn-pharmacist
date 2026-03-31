import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse');
import { readFileSync } from 'fs';
import { BulkActivityLog, BulkActionType } from '../database/entities/bulk-activity-log.entity';
import { Medicine, ScheduleClass, DosageForm } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class BulkService {
  constructor(
    @InjectRepository(BulkActivityLog)
    private logRepo: Repository<BulkActivityLog>,
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
  ) {}

  async importMedicines(filePath: string, fileName: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);

    const errors: { row: number; error: string; data: any }[] = [];
    const toInsert: any[] = [];
    let rowNum = 1;

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rowNum = rowNumber;

      const brandName = row.getCell(1).value?.toString()?.trim();
      const molecule = row.getCell(2).value?.toString()?.trim();
      const strength = row.getCell(3).value?.toString()?.trim();
      const dosageForm = row.getCell(4).value?.toString()?.trim();
      const scheduleClass = row.getCell(5).value?.toString()?.trim();
      const gstPercent = row.getCell(6).value;
      const subGroupKey = row.getCell(7).value?.toString()?.trim();
      const mrp = row.getCell(8).value;
      const saleRate = row.getCell(9).value;
      const manufacturer = row.getCell(10).value?.toString()?.trim();
      const category = row.getCell(11).value?.toString()?.trim();

      if (!brandName) return errors.push({ row: rowNumber, error: 'Brand Name is required', data: row.values });
      if (!molecule) return errors.push({ row: rowNumber, error: 'Molecule is required', data: row.values });
      if (!strength) return errors.push({ row: rowNumber, error: 'Strength is required', data: row.values });
      if (!dosageForm) return errors.push({ row: rowNumber, error: 'Dosage Form is required', data: row.values });
      if (!scheduleClass) return errors.push({ row: rowNumber, error: 'Schedule Class is required', data: row.values });

      const validSchedule = ['OTC', 'H', 'H1', 'X'];
      if (!validSchedule.includes(scheduleClass.toUpperCase())) {
        return errors.push({ row: rowNumber, error: `Invalid Schedule Class: ${scheduleClass}`, data: row.values });
      }

      const groupKey =
        subGroupKey ||
        `${molecule.toLowerCase().replace(/\s+/g, '_')}_${strength.toLowerCase().replace(/\s+/g, '')}_${dosageForm.toLowerCase()}`;

      toInsert.push({
        brand_name: brandName,
        molecule,
        strength,
        dosage_form: dosageForm as DosageForm,
        schedule_class: scheduleClass.toUpperCase() as ScheduleClass,
        substitute_group_key: groupKey,
        gst_percent: gstPercent ? Number(gstPercent) : 0,
        mrp: mrp ? Number(mrp) : null,
        sale_rate: saleRate ? Number(saleRate) : null,
        manufacturer: manufacturer || null,
        category: category || null,
      });
    });

    if (errors.length > 0) {
      await this.logActivity({
        action_type: BulkActionType.BULK_IMPORT_MEDICINE,
        file_name: fileName,
        total_rows: rowNum - 1,
        success_rows: 0,
        failed_rows: errors.length,
        performed_by: userId,
      });
      return { success: false, errors, message: `${errors.length} rows have errors. Fix and re-upload.` };
    }

    let successCount = 0;
    for (const med of toInsert) {
      try {
        const existing = await this.medicineRepo.findOne({
          where: { brand_name: med.brand_name, strength: med.strength },
        });
        if (!existing) {
          await this.medicineRepo.save(this.medicineRepo.create(med));
        }
        successCount++;
      } catch (err) {
        errors.push({ row: 0, error: err.message, data: med });
      }
    }

    await this.logActivity({
      action_type: BulkActionType.BULK_IMPORT_MEDICINE,
      file_name: fileName,
      total_rows: toInsert.length,
      success_rows: successCount,
      failed_rows: errors.length,
      performed_by: userId,
    });

    return {
      success: true,
      total_rows: toInsert.length,
      success_rows: successCount,
      failed_rows: errors.length,
      message: `${successCount} medicines imported successfully.`,
    };
  }

  async importStock(filePath: string, fileName: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);

    const errors: any[] = [];
    const toInsert: any[] = [];

    sheet.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return;

      const brandName = row.getCell(1).value?.toString()?.trim();
      const batchNo = row.getCell(2).value?.toString()?.trim();
      const expiry = row.getCell(3).value?.toString()?.trim();
      const qty = row.getCell(4).value;
      const purchasePrice = row.getCell(5).value;
      const saleRate = row.getCell(6).value;
      const supplierName = row.getCell(7).value?.toString()?.trim();

      if (!brandName) return errors.push({ row: rowNumber, error: 'Brand Name required' });
      if (!batchNo) return errors.push({ row: rowNumber, error: 'Batch No required' });
      if (!expiry) return errors.push({ row: rowNumber, error: 'Expiry required' });
      if (!qty || Number(qty) < 0) return errors.push({ row: rowNumber, error: 'Valid Quantity required' });
      if (!purchasePrice || Number(purchasePrice) < 0) return errors.push({ row: rowNumber, error: 'Purchase Price required' });
      if (!saleRate || Number(saleRate) < 0) return errors.push({ row: rowNumber, error: 'Sale Rate required' });

      toInsert.push({ brandName, batchNo, expiry, qty: Number(qty), purchasePrice: Number(purchasePrice), saleRate: Number(saleRate), supplierName });
    });

    if (errors.length > 0) {
      return { success: false, errors };
    }

    let successCount = 0;
    for (const item of toInsert) {
      try {
        const medicine = await this.medicineRepo.findOne({
          where: { brand_name: item.brandName },
        });
        if (!medicine) {
          errors.push({ row: 0, error: `Medicine not found: ${item.brandName}`, data: item });
          continue;
        }

        let supplierId = null;
        if (item.supplierName) {
          let supplier = await this.supplierRepo.findOne({
            where: { name: item.supplierName },
          });
          if (!supplier) {
            supplier = await this.supplierRepo.save(
              this.supplierRepo.create({ name: item.supplierName }),
            );
          }
          supplierId = supplier.id;
        }

        const expiryDate = new Date(`01/${item.expiry}`);
        await this.batchRepo.save(
          this.batchRepo.create({
            medicine_id: medicine.id,
            batch_number: item.batchNo,
            expiry_date: expiryDate,
            quantity: item.qty,
            purchase_price: item.purchasePrice,
            mrp: item.saleRate * 1.1,
            sale_rate: item.saleRate,
            supplier_id: supplierId,
          }),
        );
        successCount++;
      } catch (err) {
        errors.push({ row: 0, error: err.message, data: item });
      }
    }

    await this.logActivity({
      action_type: BulkActionType.BULK_IMPORT_STOCK,
      file_name: fileName,
      total_rows: toInsert.length,
      success_rows: successCount,
      failed_rows: errors.length,
      performed_by: userId,
    });

    return {
      success: successCount > 0,
      total_rows: toInsert.length,
      success_rows: successCount,
      failed_rows: errors.length,
    };
  }

  async getLogs(userId?: string) {
    return this.logRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
      take: 100,
    });
  }

  async getMedicineTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Medicine Master');

    sheet.columns = [
      { header: 'Brand Name *', key: 'brand_name', width: 25 },
      { header: 'Molecule *', key: 'molecule', width: 25 },
      { header: 'Strength *', key: 'strength', width: 15 },
      { header: 'Dosage Form *', key: 'dosage_form', width: 15 },
      { header: 'Schedule Class *', key: 'schedule_class', width: 15 },
      { header: 'GST %', key: 'gst_percent', width: 10 },
      { header: 'Substitute Group Key', key: 'sub_key', width: 30 },
      { header: 'MRP', key: 'mrp', width: 12 },
      { header: 'Sale Rate', key: 'sale_rate', width: 12 },
      { header: 'Manufacturer', key: 'manufacturer', width: 25 },
      { header: 'Category', key: 'category', width: 20 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D7D46' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    sheet.addRow(['Amoxicillin 500mg Capsule', 'Amoxicillin', '500mg', 'Capsule', 'H', 12, 'amoxicillin_500mg_capsule', 85, 80, 'Cipla', 'Antibiotic']);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async getStockTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Stock Batches');

    sheet.columns = [
      { header: 'Brand Name *', key: 'brand_name', width: 25 },
      { header: 'Batch No *', key: 'batch_no', width: 20 },
      { header: 'Expiry (MM/YYYY) *', key: 'expiry', width: 18 },
      { header: 'Quantity *', key: 'quantity', width: 12 },
      { header: 'Purchase Price *', key: 'purchase_price', width: 16 },
      { header: 'Sale Rate *', key: 'sale_rate', width: 12 },
      { header: 'Supplier', key: 'supplier', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D7D46' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    sheet.addRow(['Amoxicillin 500mg Capsule', 'BATCH001', '12/2026', 100, 45, 80, 'ABC Pharma']);

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async parseInvoicePdf(filePath: string): Promise<{
    supplier: string;
    invoiceNo: string;
    invoiceDate: string;
    items: Array<{
      medicineName: string;
      batchNo: string;
      expiry: string;
      qty: number;
      purchasePrice: number;
      mrp: number;
      gstPercent: number;
    }>;
  }> {
    const dataBuffer = readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text;
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const format = this.detectFormat(lines);
    const supplier = this.extractSupplierName(lines, format);
    const invoiceNo = this.extractInvoiceNo(lines, format);
    const invoiceDate = this.extractInvoiceDate(lines);
    const items = this.extractInvoiceItems(lines, fo  // ─── FORMAT DETECTION ────────────────────────────────────────────────────
  //
  // Supports two invoice formats:
  //   1. MARG ERP  – each product is ONE line:
  //        "1. DULOTAB-20 TAB 300490 10*10 BATCH 4/27 1 MRP PTR … IGST AMT NET"
  //   2. Reliable Software (Goa) – each field on its OWN line, expiry "MM/YY" as anchor
  //
  private detectFormat(lines: string[]): 'marg' | 'reliable' {
    // MARG invoices have a line matching the numbered-row pattern within first 60 lines
    const margRowRe = /^\d+\.\s+\S+.*\d{1,2}\/\d{2}\s+\d+\s+[\d.]+/;
    for (const line of lines.slice(0, 60)) {
      if (margRowRe.test(line)) return 'marg';
    }
    return 'reliable';
  }

  private extractSupplierName(lines: string[], format: 'marg' | 'reliable'): string {
    if (format === 'marg') {
      // MARG: first non-empty line is always the supplier/company name
      for (const line of lines.slice(0, 5)) {
        if (line.length > 3 && line.length < 80) return line.trim();
      }
      return '';
    }
    // Reliable Software original logic
    for (const line of lines.slice(0, 25)) {
      if (
        /PHARMACY|MEDICAL|DISTRIBUTOR|WHOLESALE|CHEMIST|MEDICINES/i.test(line) &&
        line.length > 4 &&
        line.length < 60 &&
        !/@/.test(line) &&
        !/GST|DL No|Pin|Email|Phone|rocketmail|gmail|yahoo/i.test(line)
      ) {
        return line.trim();
      }
    }
    return '';
  }

  private extractInvoiceNo(lines: string[], format: 'marg' | 'reliable'): string {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/Invoice\s*No[.:]?\s*:?\s*([A-Z0-9]+)/i);
      if (match) return match[1];
      if (/^Invoice\s*No/i.test(lines[i - 1] || '')) {
        const m = line.match(/^([A-Z0-9]+)/i);
        if (m) return m[1];
      }
    }
    if (format === 'reliable') {
      for (const line of lines.slice(0, 20)) {
        const m = line.match(/^(\d{4,8})$/);
        if (m) return m[1];
      }
    }
    return '';
  }

  private extractInvoiceDate(lines: string[]): string {
    for (const line of lines) {
      const m = line.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
      if (m) return m[1];
    }
    return '';
  }

  private extractInvoiceItems(lines: string[], format: 'marg' | 'reliable') {
    return format === 'marg'
      ? this.parseMargItems(lines)
      : this.parseReliableItems(lines);
  }

  // ─── MARG ERP PARSER ──────────────────────────────────────────────────────
  // Row example (from pdf-parse output, single line per medicine):
  //   "1. DULOTAB-20 TAB 300490 10*10 T-2505088A 4/27 1 1078.10 805.00 0.00 0.00 5.00 0.00 805.00 845.25"
  //
  // Column order: S# | Name | HSN | Pack | Batch | Exp(M/YY) | Qty | MRP | PTR | PTS | DISC | IGST% | ... | Amt | Net
  //
  private parseMargItems(lines: string[]) {
    const items: Array<{
      medicineName: string; batchNo: string; expiry: string;
      qty: number; purchasePrice: number; mrp: number; gstPercent: number;
    }> = [];

    // Matches: "1. NAME ... BATCH EXP QTY MRP PTR ..."
    // Batch: alphanumeric with optional hyphens, 4-20 chars
    // Exp: M/YY or MM/YY
    const rowRe = /^(\d+)\.\s+(.+?)\s+(\d{5,6})\s+[\d*x]+\s+([A-Z0-9][A-Z0-9\-]{2,18})\s+(\d{1,2}\/\d{2})\s+(\d+)\s+([\d.]+)\s+([\d.]+)/i;

    for (const line of lines) {
      const m = line.match(rowRe);
      if (!m) continue;

      const medicineName  = m[2].trim();
      // HSN is m[3], pack is already consumed
      const batchNo       = m[4].trim().toUpperCase();
      const expRaw        = m[5];   // e.g. "4/27"
      const qty           = parseInt(m[6], 10);
      const mrp           = parseFloat(m[7]);
      const purchasePrice = parseFloat(m[8]);  // PTR (Price To Retailer)

      // Convert "4/27" → "04/2027"
      const [rawMM, rawYY] = expRaw.split('/');
      const expiry = `${rawMM.padStart(2, '0')}/20${rawYY}`;

      // GST%: try to find it in the remaining tail of the line
      // Tail after PTR: "PTS DISC IGST_PCT ..."
      const tail = line.slice(line.indexOf(m[8]) + m[8].length);
      const gstMatch = tail.match(/\b(5|12|18|28)\.00\b/);
      const gstPercent = gstMatch ? parseFloat(gstMatch[1]) : 5;

      // Skip bad rows
      if (!medicineName || medicineName.length < 2) continue;
      if (qty <= 0 || purchasePrice <= 0) continue;

      items.push({ medicineName, batchNo, expiry, qty, purchasePrice, mrp, gstPercent });
    }

    return items;
  }

  // ─── RELIABLE SOFTWARE PARSER (unchanged logic) ───────────────────────────
  private parseReliableItems(lines: string[]) {
    const items: Array<{
      medicineName: string; batchNo: string; expiry: string;
      qty: number; purchasePrice: number; mrp: number; gstPercent: number;
    }> = [];

    const standaloneExpPattern = /^\d{2}\/\d{2}$/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!standaloneExpPattern.test(line)) continue;

      const expRaw = line;
      const [expMM, expYY] = expRaw.split('/');
      const expiry = `${expMM}/20${expYY}`;

      const batchNo = lines[i - 1]?.trim() ?? '';
      if (!batchNo || !/^[A-Z0-9]{4,15}$/i.test(batchNo)) continue;

      const twoBack   = lines[i - 2]?.trim() ?? '';
      const threeBack = lines[i - 3]?.trim() ?? '';

      let medicineName = '';
      if (/^\([\d.]+\)$/.test(twoBack)) {
        medicineName = threeBack.replace(/=/g, ' ').trim();
      } else {
        medicineName = twoBack.replace(/=/g, ' ').trim();
      }

      if (
        !medicineName ||
        medicineName.length < 3 ||
        /^(GST|HSN|Value|Pack|Qty|Batch|Exp|Mfr|Rate|TOTAL|SUB|NET|DISC|Round|CRN|Invoice|Drug|Phone|Email|Food|Rep|State|Trans|Pin|LR|Order|Despatch|RACK|Rack|Pd)/i.test(medicineName)
      ) continue;

      const totalQtyLine = lines[i + 2]?.trim() ?? '';
      const saleRateLine = lines[i + 4]?.trim() ?? '';
      const mrpExtraLine = lines[i + 5]?.trim() ?? '';

      const totalQtyMatch = totalQtyLine.match(/^(\d+\.\d{2})(\d+)$/);
      const qty = totalQtyMatch ? parseInt(totalQtyMatch[2], 10) : parseInt(totalQtyLine, 10);
      const purchasePrice = parseFloat(saleRateLine) || 0;

      const mrpLineMatch = mrpExtraLine.match(/^(\d+\.\d{2})/);
      const mrpFromLine = mrpLineMatch ? parseFloat(mrpLineMatch[1]) : 0;

      let mrp = mrpFromLine;
      if (/^\([\d.]+\)$/.test(twoBack)) {
        const unitMrp = parseFloat(twoBack.replace(/[()]/g, ''));
        if (unitMrp > 0) mrp = unitMrp;
      }

      const gstPercent = 5;

      if (!medicineName || !batchNo || qty <= 0 || purchasePrice <= 0) continue;

      items.push({
        medicineName: medicineName.replace(/\s+/g, ' ').trim(),
        batchNo: batchNo.toUpperCase(),
        expiry, qty, purchasePrice,
        mrp: mrp > 0 ? mrp : purchasePrice * 1.2,
        gstPercent,
      });
    }

    return items;
  }

  * 1.2,
        gstPercent,
      });
    }

    return items;
  }

  async importInvoiceItems(
    items: Array<{
      medicineName: string;
      batchNo: string;
      expiry: string;
      qty: number;
      purchasePrice: number;
      mrp: number;
      gstPercent: number;
    }>,
    supplierName: string,
    invoiceNo: string,
    userId: string,
  ) {
    let successCount = 0;
    const errors: string[] = [];

    let supplier: Supplier | null = null;
    if (supplierName) {
      supplier = await this.supplierRepo.findOne({ where: { name: supplierName } });
      if (!supplier) {
        supplier = await this.supplierRepo.save(
          this.supplierRepo.create({ name: supplierName }),
        );
      }
    }

    for (const item of items) {
      try {
        let medicine = await this.medicineRepo.findOne({
          where: { brand_name: item.medicineName },
        });

        if (!medicine) {
          medicine = await this.medicineRepo.save(
            this.medicineRepo.create({
              brand_name: item.medicineName,
              molecule: item.medicineName,
              strength: 'As per label',
              dosage_form: DosageForm.TABLET,
              schedule_class: ScheduleClass.OTC,
              gst_percent: item.gstPercent,
              mrp: item.mrp,
              sale_rate: item.purchasePrice * 1.15,
              substitute_group_key: item.medicineName
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, ''),
            }),
          );
        }

        const [mm, yyyy] = item.expiry.split('/');
        const expiryDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);

        const existing = await this.batchRepo.findOne({
          where: { medicine_id: medicine.id, batch_number: item.batchNo },
        });

        if (!existing) {
          await this.batchRepo.save(
            this.batchRepo.create({
              medicine_id: medicine.id,
              batch_number: item.batchNo,
              expiry_date: expiryDate,
              quantity: item.qty,
              purchase_price: item.purchasePrice,
              mrp: item.mrp,
              sale_rate: item.purchasePrice * 1.15,
              supplier_id: supplier?.id ?? null,
              purchase_invoice_no: invoiceNo || null,
            }),
          );
        } else {
          existing.quantity += item.qty;
          await this.batchRepo.save(existing);
        }
        successCount++;
      } catch (err) {
        errors.push(`${item.medicineName}: ${err.message}`);
      }
    }

    await this.logActivity({
      action_type: BulkActionType.BULK_IMPORT_STOCK,
      file_name: `PDF Invoice ${invoiceNo}`,
      total_rows: items.length,
      success_rows: successCount,
      failed_rows: errors.length,
      performed_by: userId,
    });

    return {
      success: successCount > 0,
      total_rows: items.length,
      success_rows: successCount,
      failed_rows: errors.length,
      errors,
    };
  }

  private async logActivity(data: {
    action_type: BulkActionType;
    file_name: string;
    total_rows: number;
    success_rows: number;
    failed_rows: number;
    performed_by: string;
  }) {
    const log = this.logRepo.create(data);
    return this.logRepo.save(log);
  }
}
