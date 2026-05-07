import { Injectable } from '@nestjs/common';
import { readFileSync } from 'fs';

export interface StandardizedStockRecord {
  brand_name: string;
  batch_no: string;
  expiry: string;
  quantity: number;
  purchase_price: number;
  sale_rate: number;
  supplier: string;
}

@Injectable()
export class VendorCsvNormalizerService {
  private detectFormat(content: string): 'MEDIWMS' | 'INTER_LINK' | 'UNKNOWN' {
    if (content.includes('H,MediWMS')) return 'MEDIWMS';
    if (content.includes('SUPPLIER') && content.includes('BILL NO')) return 'INTER_LINK';
    return 'UNKNOWN';
  }

  private parseMediWMS(lines: string[]): StandardizedStockRecord[] {
    const records: StandardizedStockRecord[] = [];
    let supplierName = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('H,')) {
        const parts = trimmed.split(',');
        supplierName = (parts[11] || '').trim();
      }

      if (trimmed.startsWith('T,')) {
        const parts = trimmed.split(',').map(p => p.trim());
        if (parts.length < 13) continue;

        records.push({
          brand_name: parts[2],
          batch_no: parts[3],
          expiry: this.normalizeExpiry(parts[4]),
          quantity: parseFloat(parts[8]) || 0,
          purchase_price: parseFloat(parts[10]) || 0,
          sale_rate: parseFloat(parts[12]) || 0,
          supplier: supplierName || 'Unknown',
        });
      }
    }
    return records;
  }

  private parseInterLink(lines: string[]): StandardizedStockRecord[] {
    const records: StandardizedStockRecord[] = [];
    if (lines.length < 2) return records;

    const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
    const col = (name: string) => headers.findIndex(h => h.includes(name));

    const iSupplier = col('SUPPLIER');
    const iItemName = col('ITEM NAME');
    const iBatch    = col('BATCH');
    const iExpiry   = col('EXPIRY');
    const iQty      = col('QTY');
    const iFtrate   = col('FTRATE');
    const iSrate    = col('SRATE');
    const iMrp      = col('MRP');

    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/`/g, ''));
      if (vals.length < 7) continue;

      const brandName = iItemName >= 0 ? vals[iItemName] : '';
      if (!brandName) continue;

      const rate = parseFloat(iFtrate >= 0 ? vals[iFtrate] : '0') ||
                   parseFloat(iSrate >= 0 ? vals[iSrate] : '0');

      records.push({
        brand_name: brandName,
        batch_no: iBatch >= 0 ? vals[iBatch] : '',
        expiry: this.normalizeExpiry(iExpiry >= 0 ? vals[iExpiry] : ''),
        quantity: parseFloat(iQty >= 0 ? vals[iQty] : '0') || 0,
        purchase_price: rate,
        sale_rate: parseFloat(iMrp >= 0 ? vals[iMrp] : '0') || 0,
        supplier: iSupplier >= 0 ? vals[iSupplier] : 'Unknown',
      });
    }
    return records;
  }

  private normalizeExpiry(raw: string): string {
    if (!raw) return '';
    raw = raw.trim();
    const match = raw.match(/^(\d{1,2})\/(\d{2,4})$/);
    if (match) {
      const mm = match[1].padStart(2, '0');
      const yyyy = match[2].length === 2 ? `20${match[2]}` : match[2];
      return `${mm}/${yyyy}`;
    }
    return raw;
  }

  async normalizeFromPath(filePath: string) {
    const content = readFileSync(filePath, 'utf-8');
    return this.normalize(content);
  }

  async normalize(csvContent: string): Promise<{
    format: string;
    records: StandardizedStockRecord[];
    errors: string[];
  }> {
    const format = this.detectFormat(csvContent);

    if (format === 'UNKNOWN') {
      return { format: 'UNKNOWN', records: [], errors: ['Could not detect vendor CSV format. Supported: Inter Link, MediWMS (Maas, PeeKay).'] };
    }

    let records: StandardizedStockRecord[] = [];
    const lines = csvContent.split(/\r?\n/).filter(l => l.trim());

    try {
      records = format === 'MEDIWMS' ? this.parseMediWMS(lines) : this.parseInterLink(lines);
    } catch (err: any) {
      return { format, records: [], errors: [`Parsing error: ${err.message}`] };
    }

    const errors: string[] = [];
    const valid: StandardizedStockRecord[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.brand_name) { errors.push(`Row ${i + 1}: Brand name missing`); continue; }
      if (!r.batch_no)   { errors.push(`Row ${i + 1}: Batch number missing`); continue; }
      if (!r.expiry)     { errors.push(`Row ${i + 1}: Expiry missing`); continue; }
      if (r.quantity <= 0) { errors.push(`Row ${i + 1}: Quantity must be > 0`); continue; }
      valid.push(r);
    }

    return { format, records: valid, errors };
  }
}
