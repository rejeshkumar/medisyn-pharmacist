// vendor-csv-normalizer.service.ts
// Place at: apps/api/src/procurement/vendor-csv-normalizer.service.ts

import { Injectable } from '@nestjs/common';

/**
 * Standardized record that matches your stock import template:
 * Brand Name, Batch No, Expiry (MM/YYYY), Quantity, Purchase Price, Sale Rate, Supplier
 */
export interface StandardizedStockRecord {
  brand_name: string;
  batch_no: string;
  expiry: string; // MM/YYYY format
  quantity: number;
  purchase_price: number;
  sale_rate: number;
  supplier: string;
}

@Injectable()
export class VendorCsvNormalizerService {
  /**
   * Detect vendor CSV format by inspecting content
   */
  private detectFormat(content: string): 'MEDIWMS' | 'INTER_LINK' | 'UNKNOWN' {
    if (content.includes('H,MediWMS')) return 'MEDIWMS';
    if (content.includes('SUPPLIER') && content.includes('BILL NO.')) return 'INTER_LINK';
    return 'UNKNOWN';
  }

  /**
   * Parse MediWMS format (H, TH, T, F rows)
   * Example: MAAS_PHARMACEUTICALS, PEEKAY_DRUGS
   */
  private parseMediWMS(csvContent: string): StandardizedStockRecord[] {
    const records: StandardizedStockRecord[] = [];
    const lines = csvContent.split('\n');
    const metadata: any = {};

    for (const line of lines) {
      const trimmed = line.trim();

      // Header row (H,MediWMS,1.0,206,02/04/2026,...)
      if (trimmed.startsWith('H,')) {
        const parts = trimmed.split(',');
        metadata.supplier_name = parts[11] || 'Unknown Supplier';
      }

      // Transaction row (T,<data>)
      if (trimmed.startsWith('T,')) {
        const parts = trimmed.split(',').map(p => p.trim());
        if (parts.length >= 18) {
          // MediWMS format:
          // [0]=T, [1]=code, [2]=name, [3]=batch, [4]=expiry, [6]=pack, [7]=items_per_pack,
          // [8]=qty, [9]=free, [10]=rate, [12]=mrp, [13]=tax%, [17]=discount%
          
          const expiryRaw = parts[4]; // e.g., "04/2028" or "1,06,27"
          const expiryFormatted = this.normalizeExpiry(expiryRaw);

          records.push({
            brand_name: parts[2],
            batch_no: parts[3],
            expiry: expiryFormatted,
            quantity: parseFloat(parts[8]) || 0,
            purchase_price: parseFloat(parts[10]) || 0, // FTRATE or SRATE
            sale_rate: parseFloat(parts[12]) || 0, // MRP
            supplier: metadata.supplier_name || 'Unknown',
          });
        }
      }
    }

    return records;
  }

  /**
   * Parse Inter Link format (single header row with vendor-specific columns)
   * Example: IL-26-1938_INTER_LINK
   */
  private parseInterLink(csvContent: string): StandardizedStockRecord[] {
    const records: StandardizedStockRecord[] = [];
    const lines = csvContent.split('\n');

    if (lines.length < 2) return records;

    // Parse header line to find column positions
    const headerLine = lines[0];
    const headers = headerLine.split(',').map(h => h.trim());
    
    const colIndex = (name: string) => 
      headers.findIndex(h => h.toUpperCase().includes(name.toUpperCase()));

    const supplierCol = colIndex('SUPPLIER');
    const itemNameCol = colIndex('ITEM NAME');
    const batchCol = colIndex('BATCH');
    const expiryCol = colIndex('EXPIRY');
    const qtyCol = colIndex('QTY');
    const rateCol = colIndex('FTRATE') >= 0 ? colIndex('FTRATE') : colIndex('SRATE');
    const mrpCol = colIndex('MRP');

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      
      if (values.length < itemNameCol + 1 || !values[itemNameCol]) continue;

      const expiryRaw = values[expiryCol] || '';
      const expiryFormatted = this.normalizeExpiry(expiryRaw);

      records.push({
        brand_name: values[itemNameCol],
        batch_no: values[batchCol] || '',
        expiry: expiryFormatted,
        quantity: parseFloat(values[qtyCol]) || 0,
        purchase_price: parseFloat(values[rateCol]) || 0,
        sale_rate: parseFloat(values[mrpCol]) || 0,
        supplier: values[supplierCol] || 'Unknown',
      });
    }

    return records;
  }

  /**
   * Normalize expiry format to MM/YYYY
   * Handles: "04/2027", "4/27", "04/27", "1, 06, 27", etc.
   */
  private normalizeExpiry(raw: string): string {
    if (!raw) return '';

    // Remove spaces and commas
    raw = raw.replace(/[\s,]/g, '');

    // Match MM/YY or MM/YYYY
    const match = raw.match(/^(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const mm = match[1].padStart(2, '0');
      const yy = match[2];
      // If 2-digit year, assume 20XX
      const yyyy = yy.length === 2 ? `20${yy}` : yy;
      return `${mm}/${yyyy}`;
    }

    return raw; // Return as-is if format doesn't match
  }

  /**
   * Main method: Normalize any vendor CSV to standard format
   */
  async normalizeVendorCsv(csvContent: string): Promise<{
    format: string;
    records: StandardizedStockRecord[];
    errors: string[];
  }> {
    const format = this.detectFormat(csvContent);

    if (format === 'UNKNOWN') {
      return {
        format: 'UNKNOWN',
        records: [],
        errors: ['Could not detect vendor CSV format. Expected MediWMS or Inter Link format.'],
      };
    }

    let records: StandardizedStockRecord[] = [];

    try {
      if (format === 'MEDIWMS') {
        records = this.parseMediWMS(csvContent);
      } else if (format === 'INTER_LINK') {
        records = this.parseInterLink(csvContent);
      }
    } catch (err: any) {
      return {
        format,
        records: [],
        errors: [`Parsing error: ${err.message}`],
      };
    }

    // Validate records
    const errors: string[] = [];
    const validRecords: StandardizedStockRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];

      if (!rec.brand_name) {
        errors.push(`Row ${i + 1}: Brand name is required`);
        continue;
      }
      if (!rec.batch_no) {
        errors.push(`Row ${i + 1}: Batch number is required`);
        continue;
      }
      if (!rec.expiry || !rec.expiry.match(/^\d{2}\/\d{4}$/)) {
        errors.push(`Row ${i + 1}: Expiry must be MM/YYYY format`);
        continue;
      }
      if (rec.quantity <= 0) {
        errors.push(`Row ${i + 1}: Quantity must be > 0`);
        continue;
      }
      if (rec.purchase_price <= 0) {
        errors.push(`Row ${i + 1}: Purchase price must be > 0`);
        continue;
      }

      validRecords.push(rec);
    }

    return {
      format,
      records: validRecords,
      errors,
    };
  }
}
