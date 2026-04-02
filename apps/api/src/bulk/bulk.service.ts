import { Injectable } from '@nestjs/common';
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

  // ── SCHEDULE NORMALIZER ──────────────────────────────────────────────────────
  // Accepts any variant and returns the DB enum value: OTC | H | H1 | X
  private normalizeSchedule(raw: string): string {
    const map: Record<string, string> = {
      'over the counter': 'OTC', 'otc': 'OTC',
      'schedule h': 'H', 'h': 'H',
      'schedule h1': 'H1', 'h1': 'H1',
      'schedule x': 'X', 'x': 'X',
    };
    return map[raw?.toLowerCase()?.trim()] ?? 'OTC';
  }

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

      const brandName    = row.getCell(1).value?.toString()?.trim();
      const molecule     = row.getCell(2).value?.toString()?.trim();
      const strength     = row.getCell(3).value?.toString()?.trim();
      const dosageForm   = row.getCell(4).value?.toString()?.trim();
      const scheduleRaw  = row.getCell(5).value?.toString()?.trim();
      const gstPercent   = row.getCell(6).value;
      const subGroupKey  = row.getCell(7).value?.toString()?.trim();
      const mrp          = row.getCell(8).value;
      const saleRate     = row.getCell(9).value;
      const manufacturer = row.getCell(10).value?.toString()?.trim();
      const category     = row.getCell(11).value?.toString()?.trim();

      if (!brandName)   return errors.push({ row: rowNumber, error: 'Brand Name is required', data: row.values });
      if (!molecule)    return errors.push({ row: rowNumber, error: 'Molecule is required', data: row.values });
      if (!strength)    return errors.push({ row: rowNumber, error: 'Strength is required', data: row.values });
      if (!dosageForm)  return errors.push({ row: rowNumber, error: 'Dosage Form is required', data: row.values });
      if (!scheduleRaw) return errors.push({ row: rowNumber, error: 'Schedule Class is required', data: row.values });

      const scheduleClass = this.normalizeSchedule(scheduleRaw);
      const validSchedule = ['OTC', 'H', 'H1', 'X'];
      if (!validSchedule.includes(scheduleClass)) {
        return errors.push({ row: rowNumber, error: `Invalid Schedule Class: ${scheduleRaw}`, data: row.values });
      }

      const groupKey = subGroupKey ||
        `${molecule.toLowerCase().replace(/\s+/g, '_')}_${strength.toLowerCase().replace(/\s+/g, '')}_${dosageForm.toLowerCase()}`;

      toInsert.push({
        brand_name: brandName, molecule, strength,
        dosage_form: dosageForm as DosageForm,
        schedule_class: scheduleClass as ScheduleClass,
        substitute_group_key: groupKey,
        gst_percent: gstPercent ? Number(gstPercent) : 0,
        mrp: mrp ? Number(mrp) : null,
        sale_rate: saleRate ? Number(saleRate) : null,
        manufacturer: manufacturer || null,
        category: category || null,
      });
    });

    if (errors.length > 0) {
      await this.logActivity({ action_type: BulkActionType.BULK_IMPORT_MEDICINE, file_name: fileName, total_rows: rowNum - 1, success_rows: 0, failed_rows: errors.length, performed_by: userId });
      return { success: false, errors, message: `${errors.length} rows have errors. Fix and re-upload.` };
    }

    let successCount = 0;
    for (const med of toInsert) {
      try {
        const existing = await this.medicineRepo.findOne({ where: { brand_name: med.brand_name, strength: med.strength } });
        if (!existing) await this.medicineRepo.save(this.medicineRepo.create(med));
        successCount++;
      } catch (err) {
        errors.push({ row: 0, error: err.message, data: med });
      }
    }

    await this.logActivity({ action_type: BulkActionType.BULK_IMPORT_MEDICINE, file_name: fileName, total_rows: toInsert.length, success_rows: successCount, failed_rows: errors.length, performed_by: userId });
    return { success: true, total_rows: toInsert.length, success_rows: successCount, failed_rows: errors.length, message: `${successCount} medicines imported successfully.` };
  }

  async importStock(filePath: string, fileName: string, userId: string) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const sheet = workbook.getWorksheet(1);

    const errors: any[] = [];
    const toInsert: any[] = [];

    sheet.eachRow(async (row, rowNumber) => {
      if (rowNumber === 1) return;
      const brandName     = row.getCell(1).value?.toString()?.trim();
      const batchNo       = row.getCell(2).value?.toString()?.trim();
      const expiry        = row.getCell(3).value?.toString()?.trim();
      const qty           = row.getCell(4).value;
      const purchasePrice = row.getCell(5).value;
      const saleRate      = row.getCell(6).value;
      const supplierName  = row.getCell(7).value?.toString()?.trim();

      if (!brandName)     return errors.push({ row: rowNumber, error: 'Brand Name required' });
      if (!batchNo)       return errors.push({ row: rowNumber, error: 'Batch No required' });
      if (!expiry)        return errors.push({ row: rowNumber, error: 'Expiry required' });
      if (!qty || Number(qty) < 0)           return errors.push({ row: rowNumber, error: 'Valid Quantity required' });
      if (!purchasePrice || Number(purchasePrice) < 0) return errors.push({ row: rowNumber, error: 'Purchase Price required' });
      if (!saleRate || Number(saleRate) < 0) return errors.push({ row: rowNumber, error: 'Sale Rate required' });

      toInsert.push({ brandName, batchNo, expiry, qty: Number(qty), purchasePrice: Number(purchasePrice), saleRate: Number(saleRate), supplierName });
    });

    if (errors.length > 0) return { success: false, errors };

    let successCount = 0;
    for (const item of toInsert) {
      try {
        let medicine = await this.medicineRepo.findOne({ where: { brand_name: item.brandName } });
        if (!medicine) {
          // Auto-create medicine so stock import never fails on missing master
          try {
            medicine = await this.medicineRepo.save(this.medicineRepo.create({
              brand_name: item.brandName,
              molecule: item.brandName,
              strength: 'As per label',
              dosage_form: DosageForm.TABLET,
              schedule_class: ScheduleClass.OTC,
              gst_percent: 5,
              mrp: item.saleRate ? item.saleRate * 1.1 : 0,
              sale_rate: item.saleRate || 0,
              substitute_group_key: item.brandName
                .toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
            }));
          } catch (createErr) {
            errors.push({ row: 0, error: `Could not create medicine: ${item.brandName}`, data: item });
            continue;
          }
        }

        let supplierId = null;
        if (item.supplierName) {
          let supplier = await this.supplierRepo.findOne({ where: { name: item.supplierName } });
          if (!supplier) supplier = await this.supplierRepo.save(this.supplierRepo.create({ name: item.supplierName }));
          supplierId = supplier.id;
        }

        await this.batchRepo.save(this.batchRepo.create({
          medicine_id: medicine.id, batch_number: item.batchNo,
          expiry_date: (() => { const [mm,yyyy] = item.expiry.split('/'); return new Date(parseInt(yyyy), parseInt(mm)-1, 1); })(),
          quantity: item.qty, purchase_price: item.purchasePrice,
          mrp: item.saleRate * 1.1, sale_rate: item.saleRate, supplier_id: supplierId,
        }));
        successCount++;
      } catch (err) {
        errors.push({ row: 0, error: err.message, data: item });
      }
    }

    await this.logActivity({ action_type: BulkActionType.BULK_IMPORT_STOCK, file_name: fileName, total_rows: toInsert.length, success_rows: successCount, failed_rows: errors.length, performed_by: userId });
    return {
      success: successCount > 0,
      total_rows: toInsert.length,
      success_rows: successCount,
      failed_rows: errors.length,
      errors: errors.map(e => ({ row: e.row ?? 0, error: e.error ?? String(e) })),
      message: successCount > 0
        ? `${successCount} stock batches imported successfully.`
        : `Import failed. ${errors.length} rows had errors.`,
    };
  }

  async getLogs(userId?: string) {
    return this.logRepo.find({ relations: ['user'], order: { created_at: 'DESC' }, take: 100 });
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
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D7D46' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.addRow(['Amoxicillin 500mg Capsule', 'Amoxicillin', '500mg', 'Capsule', 'H', 12, 'amoxicillin_500mg_capsule', 85, 80, 'Cipla', 'Antibiotic']);
    return Buffer.from(await workbook.xlsx.writeBuffer());
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
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D7D46' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.addRow(['Amoxicillin 500mg Capsule', 'BATCH001', '12/2026', 100, 45, 80, 'ABC Pharma']);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async parseInvoicePdf(filePath: string): Promise<{
    supplier: string; invoiceNo: string; invoiceDate: string;
    items: Array<{ medicineName: string; batchNo: string; expiry: string; qty: number; purchasePrice: number; mrp: number; gstPercent: number }>;
  }> {
    const pdfData = await pdfParse(readFileSync(filePath));
    const lines = pdfData.text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    const supplier    = this.extractSupplierName(lines);
    const invoiceNo   = this.extractInvoiceNo(lines);
    const invoiceDate = this.extractInvoiceDate(lines);
    const items       = this.parseMargItems(lines);

    return { supplier, invoiceNo, invoiceDate, items };
  }

  // ── SUPPLIER / INVOICE META ──────────────────────────────────────────────────
  private extractSupplierName(lines: string[]): string {
    for (const line of lines.slice(0, 5)) {
      if (line.length > 3 && line.length < 80 &&
          !/^(Phone|D\.L|GSTIN|GST|DL)/.test(line)) return line.trim();
    }
    return '';
  }

  private extractInvoiceNo(lines: string[]): string {
    for (const line of lines) {
      // Handles "Invoice NoA000279" (no space) and "Invoice No A000279"
      const m = line.match(/Invoice\s*No\s*([A-Z0-9]+)/i);
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

  // ── MARG ERP PARSER ─────────────────────────────────────────────────────────
  // Actual pdf-parse output per item (6 lines per medicine):
  //
  //   "1. 2"                          ← "S.No. Qty" on same line
  //   "20*5"                          ← Pack (ignored)
  //   "LARINA SACHET"                 ← Medicine name
  //   "FS250111D 4/27300490"          ← Batch + Exp(M/YY) + HSN concatenated
  //   "1031.20 721.84 0.00 0.00 5.00 0.00 1443.68"  ← MRP PTR PTS DISC GST% 0 Amount
  //   "1515.86"                       ← Net (ignored)
  //
  private parseMargItems(lines: string[]) {
    const items: Array<{
      medicineName: string; batchNo: string; expiry: string;
      qty: number; purchasePrice: number; mrp: number; gstPercent: number;
    }> = [];

    // Anchor: "N. QTY" — serial number and quantity on same line
    const rowRe     = /^(\d+)\.\s+(\d+)$/;
    // Batch+Exp+HSN concatenated: e.g. "FS250111D 4/27300490" or "YC92711/27300490"
    const batchExpRe = /^([A-Z0-9\-]+?)\s*(\d{1,2}\/\d{2})\d+$/i;

    for (let i = 0; i < lines.length; i++) {
      const rowMatch = lines[i].match(rowRe);
      if (!rowMatch) continue;

      const qty  = parseInt(rowMatch[2], 10);
      // pack = lines[i+1] — skip
      const name         = (lines[i + 2] || '').trim();
      const batchExpLine = (lines[i + 3] || '').trim();
      const pricesLine   = (lines[i + 4] || '').trim();

      if (!name || name.length < 2) continue;

      const beMatch = batchExpLine.match(batchExpRe);
      if (!beMatch) continue;

      const batchNo = beMatch[1].trim().toUpperCase();
      const expRaw  = beMatch[2]; // "4/27" or "11/27"
      const [mm, yy] = expRaw.split('/');
      const expiry = `${mm.padStart(2, '0')}/20${yy}`;

      // Prices: MRP PTR PTS DISC GST% 0 Amount
      const prices = pricesLine.split(/\s+/);
      const mrp    = parseFloat(prices[0] || '0');
      const ptr    = parseFloat(prices[1] || '0'); // purchase price
      const gst    = parseFloat(prices[4] || '5');

      if (qty <= 0 || ptr <= 0) continue;

      items.push({ medicineName: name, batchNo, expiry, qty, purchasePrice: ptr, mrp: mrp > 0 ? mrp : ptr * 1.2, gstPercent: gst });
    }

    return items;
  }

  async importInvoiceItems(
    items: Array<{ medicineName: string; batchNo: string; expiry: string; qty: number; purchasePrice: number; mrp: number; gstPercent: number }>,
    supplierName: string, invoiceNo: string, userId: string,
  ) {
    let successCount = 0;
    const errors: string[] = [];

    let supplier: Supplier | null = null;
    if (supplierName) {
      supplier = await this.supplierRepo.findOne({ where: { name: supplierName } });
      if (!supplier) supplier = await this.supplierRepo.save(this.supplierRepo.create({ name: supplierName }));
    }

    for (const item of items) {
      try {
        let medicine = await this.medicineRepo.findOne({ where: { brand_name: item.medicineName } });
        if (!medicine) {
          medicine = await this.medicineRepo.save(this.medicineRepo.create({
            brand_name: item.medicineName, molecule: item.medicineName,
            strength: 'As per label', dosage_form: DosageForm.TABLET,
            schedule_class: ScheduleClass.OTC, gst_percent: item.gstPercent,
            mrp: item.mrp, sale_rate: item.purchasePrice * 1.15,
            substitute_group_key: item.medicineName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          }));
        }

        const [mm, yyyy] = item.expiry.split('/');
        const expiryDate = new Date(parseInt(yyyy), parseInt(mm) - 1, 1);

        const existing = await this.batchRepo.findOne({ where: { medicine_id: medicine.id, batch_number: item.batchNo } });
        if (!existing) {
          await this.batchRepo.save(this.batchRepo.create({
            medicine_id: medicine.id, batch_number: item.batchNo,
            expiry_date: expiryDate, quantity: item.qty,
            purchase_price: item.purchasePrice, mrp: item.mrp,
            sale_rate: item.purchasePrice * 1.15,
            supplier_id: supplier?.id ?? null, purchase_invoice_no: invoiceNo || null,
          }));
        } else {
          existing.quantity += item.qty;
          await this.batchRepo.save(existing);
        }
        successCount++;
      } catch (err) {
        errors.push(`${item.medicineName}: ${err.message}`);
      }
    }

    await this.logActivity({ action_type: BulkActionType.BULK_IMPORT_STOCK, file_name: `PDF Invoice ${invoiceNo}`, total_rows: items.length, success_rows: successCount, failed_rows: errors.length, performed_by: userId });
    return { success: successCount > 0, total_rows: items.length, success_rows: successCount, failed_rows: errors.length, errors };
  }

  private async logActivity(data: { action_type: BulkActionType; file_name: string; total_rows: number; success_rows: number; failed_rows: number; performed_by: string }) {
    return this.logRepo.save(this.logRepo.create(data));
  }
}
