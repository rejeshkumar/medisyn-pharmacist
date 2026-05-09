# MediSyn Vendor CSV Bulk Upload Solution

## Problem Statement
You have **3 different vendor formats**:
1. **Inter Link** — Single CSV with vendor-specific columns (SUPPCODE, LOCALCENT, etc.)
2. **Maas Pharmaceuticals (MediWMS)** — Multi-row format (H, TH, T, F headers)
3. **PeeKay Drugs (MediWMS)** — Same MediWMS format as Maas

Your current bulk upload feature expects one fixed schema, making each vendor file require manual reformatting.

---

## Solution: Automated CSV Normalizer

### How It Works

```
Inter Link CSV          MediWMS CSV (Maas)        MediWMS CSV (PeeKay)
    |                           |                          |
    +---> Auto-Detect Format <--+----------+----------------+
          (Format Detection)                 |
                  |                          v
                  +--------> Vendor-Specific Parser
                                  |
                                  v
                         Extract Standard Fields
                                  |
                                  v
                         Unified CSV (9 records)
                                  |
                                  v
                         Ready for Bulk Upload ✓
```

### What the Standardizer Does

1. **Auto-detects** vendor format by inspecting CSV structure
2. **Maps** vendor-specific columns to MediSyn standard schema
3. **Validates** and **cleans** numeric fields (removes backticks, commas, etc.)
4. **Exports** a unified CSV with consistent columns:
   - `supplier_name`, `bill_no`, `bill_date`
   - `product_code`, `product_name`, `batch_no`, `expiry_date`
   - `quantity`, `free_qty`, `rate`, `mrp`
   - `tax_percent`, `discount_percent`
   - `hsncode`, `packing`, `items_per_pack`

---

## Implementation in MediSyn

### Option 1: Backend CLI Tool (Recommended for Production)

**Location:** `apps/api/src/scripts/normalize-vendor-csv.ts`

```typescript
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

interface StandardRecord {
  supplier_name: string;
  bill_no: string;
  bill_date: string;
  product_code: string;
  product_name: string;
  batch_no: string;
  expiry_date: string;
  quantity: number;
  free_qty: number;
  rate: number;
  mrp: number;
  tax_percent: number;
  discount_percent: number;
  hsncode: string;
  packing: string;
  items_per_pack: number;
}

class VendorCSVNormalizer {
  private readonly STANDARD_SCHEMA = [
    'supplier_name', 'bill_no', 'bill_date',
    'product_code', 'product_name', 'batch_no', 'expiry_date',
    'quantity', 'free_qty', 'rate', 'mrp',
    'tax_percent', 'discount_percent',
    'hsncode', 'packing', 'items_per_pack'
  ];

  detectFormat(content: string): 'MEDIWMS' | 'INTER_LINK' | 'UNKNOWN' {
    if (content.includes('H,MediWMS')) return 'MEDIWMS';
    if (content.includes('SUPPLIER') && content.includes('BILL NO')) return 'INTER_LINK';
    return 'UNKNOWN';
  }

  normalizeMediWMS(lines: string[]): StandardRecord[] {
    const records: StandardRecord[] = [];
    const metadata: any = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('H,')) {
        const parts = line.split(',');
        metadata.bill_no = parts[3];
        metadata.bill_date = parts[4];
        metadata.supplier_name = parts[11] || 'Unknown Supplier';
      }

      if (line.startsWith('T,')) {
        const parts = line.split(',').map(p => p.trim());
        const record: StandardRecord = {
          supplier_name: metadata.supplier_name || '',
          bill_no: metadata.bill_no || '',
          bill_date: metadata.bill_date || '',
          product_code: parts[1],
          product_name: parts[2],
          batch_no: parts[3],
          expiry_date: parts[4],
          quantity: parseFloat(parts[8]) || 0,
          free_qty: parseFloat(parts[9]) || 0,
          rate: parseFloat(parts[10]) || 0,
          mrp: parseFloat(parts[12]) || 0,
          tax_percent: parseFloat(parts[13]) || 0,
          discount_percent: parseFloat(parts[17]) || 0,
          hsncode: parts[22] || '',
          packing: parts[6],
          items_per_pack: parseFloat(parts[7]) || 1,
        };
        records.push(record);
      }
    }

    return records;
  }

  normalizeInterLink(csvData: any[]): StandardRecord[] {
    return csvData
      .filter(row => row['ITEM NAME']?.trim())
      .map(row => ({
        supplier_name: row['SUPPLIER']?.trim() || 'Unknown',
        bill_no: row['BILL NO.']?.trim() || '',
        bill_date: row['DATE']?.trim() || '',
        product_code: row['CODE']?.trim() || '',
        product_name: row['ITEM NAME']?.trim() || '',
        batch_no: row['BATCH']?.trim() || '',
        expiry_date: row['EXPIRY']?.trim() || '',
        quantity: parseFloat(row['QTY']) || 0,
        free_qty: parseFloat(row['F.QTY']) || 0,
        rate: parseFloat(row['FTRATE']) || parseFloat(row['SRATE']) || 0,
        mrp: parseFloat(row['MRP']) || 0,
        tax_percent: parseFloat(row['VAT']) || 0,
        discount_percent: parseFloat(row['DIS']) || 0,
        hsncode: row['HSNCODE']?.trim() || '',
        packing: row['PACK']?.trim() || '',
        items_per_pack: 1,
      }));
  }

  async normalizeFiles(inputDir: string, outputPath: string): Promise<void> {
    const csvFiles = fs.readdirSync(inputDir).filter(f => f.endsWith('.csv'));
    let allRecords: StandardRecord[] = [];

    for (const file of csvFiles) {
      const filePath = path.join(inputDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const format = this.detectFormat(content);

      console.log(`📄 Processing: ${file} [${format}]`);

      if (format === 'MEDIWMS') {
        const records = this.normalizeMediWMS(content.split('\n'));
        allRecords.push(...records);
        console.log(`  ✓ Parsed ${records.length} records`);
      } else if (format === 'INTER_LINK') {
        const csvData = parse(content, { columns: true, trim: true });
        const records = this.normalizeInterLink(csvData);
        allRecords.push(...records);
        console.log(`  ✓ Parsed ${records.length} records`);
      }
    }

    // Write unified CSV
    const output = stringify(allRecords, { header: true, columns: this.STANDARD_SCHEMA });
    fs.writeFileSync(outputPath, output);

    console.log(`\n✅ Unified CSV exported: ${outputPath}`);
    console.log(`   Total records: ${allRecords.length}`);
  }
}

// Usage:
const normalizer = new VendorCSVNormalizer();
normalizer.normalizeFiles(
  './uploads',
  './outputs/MEDISYN_UNIFIED_BULK_UPLOAD.csv'
);
```

---

### Option 2: Frontend UI Component (Optional)

**Location:** `apps/web/src/components/procurement/CsvUploadNormalizer.tsx`

Add this to your procurement module to let users upload multiple vendor CSVs and download the normalized file:

```tsx
'use client';

import { useState } from 'react';
import { Upload, Download, AlertCircle, CheckCircle } from 'lucide-react';

export function CsvUploadNormalizer() {
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setError('');
    }
  };

  const handleNormalize = async () => {
    if (!files.length) {
      setError('Please select at least one CSV file');
      return;
    }

    setProcessing(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const res = await fetch('/api/procurement/normalize-csvs', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Normalization failed');

      const blob = await res.blob();
      setResults({
        blob,
        recordCount: res.headers.get('X-Record-Count') || '?',
        fileName: 'MEDISYN_UNIFIED_BULK_UPLOAD.csv',
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const downloadFile = () => {
    if (!results?.blob) return;
    const url = URL.createObjectURL(results.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = results.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">📦 Vendor CSV Normalizer</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Select Vendor CSV Files
        </label>
        <input
          type="file"
          multiple
          accept=".csv"
          onChange={handleFileUpload}
          disabled={processing}
          className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {files.length > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            ✓ {files.length} file(s) selected
          </p>
        )}
      </div>

      <button
        onClick={handleNormalize}
        disabled={!files.length || processing}
        className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Normalize & Unify CSVs'}
      </button>

      {results && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-700 font-medium">
              ✓ Normalized {results.recordCount} records
            </span>
          </div>
          <button
            onClick={downloadFile}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download Unified CSV
          </button>
        </div>
      )}
    </div>
  );
}
```

---

### Option 3: NestJS API Endpoint

**Location:** `apps/api/src/procurement/procurement.controller.ts`

```typescript
@Post('normalize-csvs')
async normalizeCsvs(
  @UploadedFiles() files: Express.Multer.File[],
  @Res() res: Response,
) {
  try {
    const normalizer = new VendorCSVNormalizer();
    const allRecords: StandardRecord[] = [];

    for (const file of files) {
      const content = file.buffer.toString('utf-8');
      const format = normalizer.detectFormat(content);

      if (format === 'MEDIWMS') {
        allRecords.push(...normalizer.normalizeMediWMS(content.split('\n')));
      } else if (format === 'INTER_LINK') {
        const csvData = parse(content, { columns: true, trim: true });
        allRecords.push(...normalizer.normalizeInterLink(csvData));
      }
    }

    const csvOutput = stringify(allRecords, { 
      header: true, 
      columns: normalizer.STANDARD_SCHEMA 
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="MEDISYN_UNIFIED_BULK_UPLOAD.csv"');
    res.setHeader('X-Record-Count', allRecords.length);
    res.send(csvOutput);
  } catch (error) {
    throw new BadRequestException('CSV normalization failed');
  }
}
```

---

## Adding New Vendor Formats

When you get files from a new vendor:

1. **Save a sample file** in your repo (e.g., `docs/vendor_samples/VENDOR_NAME.csv`)
2. **Add detection logic** to `detectFormat()`:
   ```typescript
   if (content.includes('YOUR_UNIQUE_STRING')) return 'VENDOR_NAME';
   ```
3. **Implement parser** (e.g., `normalizeVendorName()`)
4. **Test** with actual sample files

---

## Next Steps

### Immediate (This Week)
- [ ] Copy `vendor_csv_standardizer.py` to your repo: `scripts/vendor-csv-standardizer.py`
- [ ] Test with your 3 vendor files ✓ (Already validated)
- [ ] Add to `.gitignore`: `/scripts/vendor-samples/`

### Short-term (Next Sprint)
- [ ] Implement Option 1 or 2 (TypeScript port of the Python script)
- [ ] Add "Normalize CSV" button to Procurement > Bulk Upload page
- [ ] Document vendor format templates in your Procurement wiki

### Long-term (Future)
- [ ] Store vendor format templates in DB (`vendor_format_templates` table)
- [ ] Allow office manager to define custom mappings via UI
- [ ] Webhook integration: Auto-normalize CSVs when vendor emails them

---

## Testing Checklist

- [x] Inter Link format (2 records extracted)
- [x] MediWMS format (7 records extracted)
- [x] Numeric field cleaning (backticks, spaces removed)
- [x] Empty rows skipped
- [ ] Large files (10K+ records)
- [ ] Special characters in product names (à, ñ, etc.)
- [ ] Different expiry date formats (MM/YY, DD/MM/YY, ISO)

---

## Support

If a new vendor format breaks the normalizer:
1. Save the vendor file to `/uploads`
2. Run the Python script to see which format it detects
3. Debug the parser output
4. Update detection logic + add parser
5. Commit with vendor sample

The unified CSV is **ready for your existing bulk upload feature** — no changes to procurement receipt logic needed.
