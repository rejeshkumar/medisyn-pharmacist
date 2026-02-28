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

    const supplier = this.extractSupplierName(lines);
    const invoiceNo = this.extractInvoiceNo(lines);
    const invoiceDate = this.extractInvoiceDate(lines);
    const items = this.extractInvoiceItems(lines);

    return { supplier, invoiceNo, invoiceDate, items };
  }

  private extractSupplierName(lines: string[]): string {
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

  private extractInvoiceNo(lines: string[]): string {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/Invoice\s*No[.:]?\s*:?\s*(\w+)/i);
      if (match) return match[1];
      if (/^Invoice\s*No/i.test(lines[i - 1] || '')) {
        const m = line.match(/^(\d+)/);
        if (m) return m[1];
      }
    }
    for (const line of lines.slice(0, 20)) {
      const m = line.match(/^(\d{4,8})$/);
      if (m) return m[1];
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

  private extractInvoiceItems(lines: string[]) {
    const items: Array<{
      medicineName: string;
      batchNo: string;
      expiry: string;
      qty: number;
      purchasePrice: number;
      mrp: number;
      gstPercent: number;
    }> = [];

    // In Reliable Software (Goa) invoices, pdf-parse splits each field onto its own line.
    // Per medicine the structure is:
    //   [name line]           e.g. "WYSOLONE=10MG=DT TABLETS"
    //   [(MRP) line]          e.g. "(20.2900)"  — optional, present for strip-pack items
    //   [batch line]          e.g. "MP7382"
    //   [expiry line]         e.g. "04/27"       ← anchor point
    //   [pack line]           e.g. "5"
    //   [totalValue+qty line] e.g. "156.2015"   (value 156.20 concatenated with qty 15)
    //   [discount% line]      e.g. "10"
    //   [saleRate line]       e.g. "15.62"
    //   [mrp+HSN+extra line]  e.g. "19.0230043912D2PFIZE"
    //   [page ref line]       e.g. "3"

    const standaloneExpPattern = /^\d{2}\/\d{2}$/; // exactly "MM/YY"

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Only standalone expiry date lines (MM/YY) are the anchor
      if (!standaloneExpPattern.test(line)) continue;

      const expRaw = line;
      const [expMM, expYY] = expRaw.split('/');
      const expiry = `${expMM}/20${expYY}`;

      // Batch is the line immediately before the expiry
      const batchNo = lines[i - 1]?.trim() ?? '';
      if (!batchNo || !/^[A-Z0-9]{4,15}$/i.test(batchNo)) continue;

      // Medicine name: check 2 lines back; if that's a bracketed MRP, go 3 lines back
      const twoBack = lines[i - 2]?.trim() ?? '';
      const threeBack = lines[i - 3]?.trim() ?? '';

      let medicineName = '';
      if (/^\([\d.]+\)$/.test(twoBack)) {
        // "(20.2900)" pattern — name is 3 lines back
        medicineName = threeBack.replace(/=/g, ' ').trim();
      } else {
        medicineName = twoBack.replace(/=/g, ' ').trim();
      }

      // Skip if name looks like header/footer content
      if (
        !medicineName ||
        medicineName.length < 3 ||
        /^(GST|HSN|Value|Pack|Qty|Batch|Exp|Mfr|Rate|TOTAL|SUB|NET|DISC|Round|CRN|Invoice|Drug|Phone|Email|Food|Rep|State|Trans|Pin|LR|Order|Despatch|RACK|Rack|Pd)/i.test(medicineName)
      )
        continue;

      // Lines after expiry
      const packLine       = lines[i + 1]?.trim() ?? '';  // e.g. "5"
      const totalQtyLine   = lines[i + 2]?.trim() ?? '';  // e.g. "156.2015"
      const discountLine   = lines[i + 3]?.trim() ?? '';  // e.g. "10"
      const saleRateLine   = lines[i + 4]?.trim() ?? '';  // e.g. "15.62"
      const mrpExtraLine   = lines[i + 5]?.trim() ?? '';  // e.g. "19.0230043912D2PFIZE"

      // Extract qty from "156.2015" → value=156.20, qty=15
      // Pattern: decimal with exactly 2 decimal places followed by integer digits
      const totalQtyMatch = totalQtyLine.match(/^(\d+\.\d{2})(\d+)$/);
      const qty = totalQtyMatch ? parseInt(totalQtyMatch[2], 10) : parseInt(totalQtyLine, 10);

      const purchasePrice = parseFloat(saleRateLine) || 0;

      // Extract MRP from "19.0230043912D2PFIZE" — first decimal with exactly 2 places
      const mrpLineMatch = mrpExtraLine.match(/^(\d+\.\d{2})/);
      const mrpFromLine = mrpLineMatch ? parseFloat(mrpLineMatch[1]) : 0;

      // If there's a bracketed unit-MRP line between name and batch, use that
      let mrp = mrpFromLine;
      if (/^\([\d.]+\)$/.test(twoBack)) {
        const unitMrp = parseFloat(twoBack.replace(/[()]/g, ''));
        if (unitMrp > 0) mrp = unitMrp;
      }

      // GST% — default to 5% (most pharma items); could be refined from GST summary
      const gstPercent = 5;

      if (!medicineName || !batchNo || qty <= 0 || purchasePrice <= 0) continue;

      items.push({
        medicineName: medicineName.replace(/\s+/g, ' ').trim(),
        batchNo: batchNo.toUpperCase(),
        expiry,
        qty,
        purchasePrice,
        mrp: mrp > 0 ? mrp : purchasePrice * 1.2,
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
