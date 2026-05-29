import { Controller, Post, Headers, ForbiddenException, UploadedFile, UseInterceptors, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as XLSX from 'xlsx';

const TENANT = '00000000-0000-0000-0000-000000000001';

@Controller('admin')
export class ImportStockController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Clear all data before fresh import ──────────────────────────────────────
  @Public()
  @Post('clear-stock')
  async clearStock(@Headers('x-admin-key') key: string) {
    const adminKey = process.env.ADMIN_IMPORT_KEY;
    if (!adminKey || key !== adminKey) throw new ForbiddenException();
    const tables = [
      'refill_followups', 'medication_plans', 'demand_requests',
      'credit_note_items', 'schedule_drug_logs', 'prescription_items',
      'prescriptions', 'sale_items', 'sales',
      'purchase_order_items', 'reorder_flags', 'stock_batches', 'medicines',
    ];
    const results: any = {};
    for (const table of tables) {
      try {
        const r = await this.ds.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [TENANT]);
        results[table] = r[1] ?? 'ok';
      } catch (e: any) {
        results[table] = `error: ${e.message}`;
      }
    }
    const [{ count }] = await this.ds.query(`SELECT COUNT(*) FROM medicines WHERE tenant_id = $1`, [TENANT]);
    return { status: 'cleared', medicines_remaining: count, results };
  }

  // ── Data Integrity Check Endpoint ───────────────────────────────────────────
  @Public()
  @Get('check-data-integrity')
  async checkDataIntegrity(@Headers('x-admin-key') key: string) {
    const adminKey = process.env.ADMIN_IMPORT_KEY;
    if (!adminKey || key !== adminKey) throw new ForbiddenException();

    const issues: any = {
      duplicate_batches: [],
      duplicate_medicines: [],
      orphan_batches: [],
      missing_molecule: [],
    };

    // Check for duplicate batch numbers across different medicines
    const dupBatches = await this.ds.query(`
      SELECT 
        batch_number,
        COUNT(DISTINCT medicine_id) as medicine_count,
        array_agg(DISTINCT m.brand_name) as medicine_names,
        array_agg(DISTINCT sb.id) as batch_ids
      FROM stock_batches sb
      JOIN medicines m ON m.id = sb.medicine_id
      WHERE sb.tenant_id = $1
      GROUP BY batch_number
      HAVING COUNT(DISTINCT medicine_id) > 1
    `, [TENANT]);
    issues.duplicate_batches = dupBatches;

    // Check for potentially duplicate medicine names (fuzzy match)
    const allMeds = await this.ds.query(`
      SELECT id, brand_name, molecule, manufacturer
      FROM medicines 
      WHERE tenant_id = $1
      ORDER BY brand_name
    `, [TENANT]);

    const normalizeName = (name: string): string => {
      return name
        .toUpperCase()
        .replace(/\s+/g, ' ')
        .replace(/^(TAB|CAP|SYP|INJ|CREAM|GEL|OINT)\s+/i, '')
        .replace(/\s+(TAB|TABLET|CAP|CAPSULE|SYP|SYRUP|INJ|INJECTION)\s*(\(.*?\))?$/i, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    };

    const normalized = new Map<string, any[]>();
    for (const med of allMeds) {
      const norm = normalizeName(med.brand_name);
      if (!normalized.has(norm)) normalized.set(norm, []);
      normalized.get(norm)!.push(med);
    }

    for (const [norm, meds] of normalized) {
      if (meds.length > 1) {
        issues.duplicate_medicines.push({
          normalized_name: norm,
          count: meds.length,
          medicines: meds.map(m => ({ id: m.id, brand_name: m.brand_name })),
        });
      }
    }

    // Check for medicines with missing molecule info
    const missingMolecule = await this.ds.query(`
      SELECT id, brand_name, molecule
      FROM medicines
      WHERE tenant_id = $1 
        AND (molecule IS NULL OR molecule = '' OR molecule = brand_name)
      ORDER BY created_at DESC
      LIMIT 50
    `, [TENANT]);
    issues.missing_molecule = missingMolecule;

    return {
      status: 'integrity_check_complete',
      timestamp: new Date().toISOString(),
      issues,
      summary: {
        duplicate_batch_numbers: dupBatches.length,
        potential_duplicate_medicines: issues.duplicate_medicines.length,
        medicines_missing_molecule: missingMolecule.length,
      },
    };
  }

  // ── Import stock from Purchase/Sales Excel ──────────────────────────────────
  @Public()
  @Post('import-stock')
  @UseInterceptors(FileInterceptor('file'))
  async importStock(
    @Headers('x-admin-key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const adminKey = process.env.ADMIN_IMPORT_KEY;
    if (!adminKey || key !== adminKey) throw new ForbiddenException();

    // ── Parse Excel ──────────────────────────────────────────────────────────
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Find header row (contains 'Drug Name' or 'Brand Name *' for SimpliRx template)
    let headerIdx = 0;
    for (let i = 0; i < 10; i++) {
      const row = raw[i];
      if (row?.includes('Drug Name') || row?.includes('Brand Name *') || row?.includes('Brand Name')) {
        headerIdx = i;
        break;
      }
    }
    const headers: string[] = raw[headerIdx];
    const data = raw.slice(headerIdx + 1).map(row => {
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });

    // ── Normalize column names to support multiple template formats ──────────
    const normalize = (row: any): any => {
      const r = { ...row };
      // Support new SimpliRx template columns alongside old vendor CSV columns
      if (!r['Drug Name'] && r['Brand Name *'])         r['Drug Name']   = r['Brand Name *'];
      if (!r['Drug Name'] && r['Brand Name'])           r['Drug Name']   = r['Brand Name'];
      if (!r['Avail Qty'] && r['Quantity *'])           r['Avail Qty']   = r['Quantity *'];
      if (!r['Avail Qty'] && r['Quantity'])             r['Avail Qty']   = r['Quantity'];
      if (!r['Batch No'] && r['Batch No *'])            r['Batch No']    = r['Batch No *'];
      if (!r['Rate'] && r['Purchase Price *'])          r['Rate']        = r['Purchase Price *'];
      if (!r['Rate'] && r['Purchase Price'])            r['Rate']        = r['Purchase Price'];
      if (!r['Mrp'] && r['MRP *'])                     r['Mrp']         = r['MRP *'];
      if (!r['Mrp'] && r['MRP'])                       r['Mrp']         = r['MRP'];
      if (!r['Mrp'] && r['Sale Rate *'])               r['Mrp']         = r['Sale Rate *'];
      if (!r['Mrp'] && r['Sale Rate'])                 r['Mrp']         = r['Sale Rate'];
      if (!r['Expiry By'] && r['Expiry (MM/YYYY) *'])  r['Expiry By']   = r['Expiry (MM/YYYY) *'];
      if (!r['Expiry By'] && r['Expiry (MM/YYYY)'])    r['Expiry By']   = r['Expiry (MM/YYYY)'];
      if (!r['Expiry By'] && r['Expiry'])              r['Expiry By']   = r['Expiry'];
      if (!r['Mfg Name'] && r['Supplier'])             r['Mfg Name']    = r['Supplier'];
      return r;
    };
    const normalizedData = data.map(normalize);

    // Only rows with available stock
    const stockRows = normalizedData.filter(r => r['Drug Name'] && Number(r['Avail Qty'] || 0) > 0);

    // ── Helpers ───────────────────────────────────────────────────────────────
    // Safe float — null if invalid/negative
    const f = (v: any): number | null => {
      const n = parseFloat(String(v ?? '').replace(',', '').trim());
      return isNaN(n) || n < 0 ? null : n;
    };

    // Safe integer — rounds decimals (tabs_per_strip must be integer in DB)
    const int = (v: any): number | null => {
      const n = f(v);
      return n !== null ? Math.round(n) : null;
    };

    // Safe string — null if empty
    const str = (v: any): string | null => {
      const s = String(v ?? '').trim();
      return s || null;
    };

    // GST percent — must be 0-100, default 0 (NOT NULL in DB)
    const gstVal = (v: any): number => {
      const n = f(v);
      return (n !== null && n <= 100) ? n : 0;
    };

    // Dosage form inferred from drug name prefix
    const dosage = (name: string): string => {
      const n = name.toUpperCase();
      if (n.startsWith('TAB ') || n.includes(' TAB ')) return 'tablet';
      if (n.startsWith('CAP ') || n.includes(' CAP ')) return 'capsule';
      if (n.startsWith('SYP ') || n.startsWith('SYR ')) return 'syrup';
      if (n.startsWith('INJ ') || n.includes(' INJ ')) return 'injection';
      if (n.includes('CREAM')) return 'cream';
      if (n.includes('OINT')) return 'ointment';
      if (n.includes('GEL')) return 'gel';
      if (n.includes('DROP')) return 'drops';
      if (n.includes('SPRAY')) return 'spray';
      if (n.includes('PASTE')) return 'paste';
      if (n.includes('POWDER') || n.includes(' PDR')) return 'powder';
      if (n.includes('SACHET')) return 'sachet';
      if (n.includes('SUSP')) return 'suspension';
      if (n.includes('LOTION')) return 'lotion';
      return 'other';
    };

    // Parse expiry: 'Apr-2028', 'Apr-28', 'Sep-27', '12/2026', '12/26' → YYYY-MM-DD (last day of month)
    const expiry = (v: any): string | null => {
      if (!v) return null;
      const s = String(v).trim();
      const months: any = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
      // Format: Mon-YYYY or Mon-YY e.g. 'Apr-2028', 'Sep-27'
      const m1 = s.match(/^([A-Za-z]{3})-(\d{2,4})$/);
      if (m1) {
        const mon = months[m1[1]] || 1;
        const yr = m1[2].length === 2 ? 2000 + parseInt(m1[2]) : parseInt(m1[2]);
        const last = new Date(yr, mon, 0).getDate();
        return `${yr}-${String(mon).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
      }
      // Format: MM/YYYY or MM/YY e.g. '12/2026', '12/26'
      const m2 = s.match(/^(\d{1,2})\/(\d{2,4})$/);
      if (m2) {
        const mon = parseInt(m2[1]);
        const yr = m2[2].length === 2 ? 2000 + parseInt(m2[2]) : parseInt(m2[2]);
        const last = new Date(yr, mon, 0).getDate();
        return `${yr}-${String(mon).padStart(2,'0')}-${String(last).padStart(2,'0')}`;
      }
      return null;
    };

    // ── Helper: Normalize medicine name for fuzzy matching ──────────────────
    const normalizeName = (name: string): string => {
      return name
        .toUpperCase()
        .replace(/\s+/g, ' ')           // normalize spaces
        .replace(/^(TAB|CAP|SYP|INJ|CREAM|GEL|OINT)\s+/i, '')  // strip dosage form prefix
        .replace(/\s+(TAB|TABLET|CAP|CAPSULE|SYP|SYRUP|INJ|INJECTION)\s*(\(.*?\))?$/i, '')  // strip suffix
        .replace(/[^\w\s]/g, '')        // remove special chars
        .trim();
    };

    // ── Upsert medicines with fuzzy matching ────────────────────────────────
    const medMap = new Map<string, string>();
    const uniqueMeds = new Map<string, any>();
    for (const row of stockRows) {
      const name = String(row['Drug Name']).trim();
      if (!uniqueMeds.has(name)) uniqueMeds.set(name, row);
    }

    let medInserted = 0, medUpdated = 0, medMatched = 0;
    const matchLog: any[] = [];

    for (const [name, row] of uniqueMeds) {
      const mrp          = f(row['Mrp']) ?? 0;
      const manufacturer = str(row['Mfg Name']);
      const hsn          = str(row['HSN Code']);
      const gstPct       = gstVal(row['Tax%']);
      const strips       = int(row['Strip Qty']);
      const form         = dosage(name);

      // STEP 1: Try exact match
      let existing = await this.ds.query(
        `SELECT id, brand_name FROM medicines WHERE LOWER(TRIM(brand_name)) = LOWER($1) AND tenant_id = $2 LIMIT 1`,
        [name, TENANT]
      );

      let matchType = 'exact';

      // STEP 2: If no exact match, try fuzzy match
      if (existing.length === 0) {
        const normalized = normalizeName(name);
        const allMeds = await this.ds.query(
          `SELECT id, brand_name FROM medicines WHERE tenant_id = $1`,
          [TENANT]
        );
        
        for (const med of allMeds) {
          if (normalizeName(med.brand_name) === normalized) {
            existing = [med];
            matchType = 'fuzzy';
            medMatched++;
            matchLog.push({
              csv_name: name,
              matched_to: med.brand_name,
              normalized: normalized,
            });
            break;
          }
        }
      }

      if (existing.length > 0) {
        const id = existing[0].id;
        await this.ds.query(`
          UPDATE medicines SET
            manufacturer   = COALESCE($1, manufacturer),
            hsn_code       = COALESCE($2, hsn_code),
            mrp            = $3,
            sale_rate      = $3,
            gst_percent    = $4,
            tabs_per_strip = COALESCE($5, tabs_per_strip),
            updated_at     = NOW()
          WHERE id = $6
        `, [manufacturer, hsn, mrp, gstPct, strips, id]);
        medMap.set(name, id);
        medUpdated++;
      } else {
        const res = await this.ds.query(`
          INSERT INTO medicines (
            brand_name, molecule, strength, dosage_form,
            manufacturer, hsn_code,
            mrp, sale_rate, gst_percent, tabs_per_strip,
            is_active, is_rx_required, is_chronic,
            tenant_id, created_at, updated_at
          ) VALUES (
            $1, '', '', $2,
            $3, $4,
            $5, $5, $6, $7,
            true, false, false,
            $8, NOW(), NOW()
          ) RETURNING id
        `, [name, form, manufacturer, hsn, mrp, gstPct, strips, TENANT]);
        medMap.set(name, res[0].id);
        medInserted++;
      }
    }

    // ── Insert stock batches with validation ────────────────────────────────
    let batchInserted = 0, batchUpdated = 0;
    const batchConflicts: any[] = [];

    for (const row of stockRows) {
      const name    = String(row['Drug Name']).trim();
      const medId   = medMap.get(name);
      if (!medId) continue;

      const batchNo  = str(row['Batch No']);
      const qty      = f(row['Avail Qty']) ?? 0;
      const cost     = f(row['Rate']);
      const mrp      = f(row['Mrp']) ?? 0;
      const invoiceNo= str(row['Invoice No']);
      const freeQty  = f(row['Free Qty']);
      const batchQty = f(row['Batch Qty']);
      const discAmt  = f(row['Discount Amount']);
      const taxAmt   = f(row['Tax Amount']);
      const purVal   = f(row['Purchase Value']);
      const exp      = expiry(row['Expiry By']);

      // Check if batch exists for THIS medicine
      const existing = await this.ds.query(
        `SELECT id FROM stock_batches WHERE medicine_id=$1 AND batch_number=$2 AND tenant_id=$3 LIMIT 1`,
        [medId, batchNo, TENANT]
      );

      // CRITICAL: Check if batch exists for DIFFERENT medicine (data integrity issue)
      const conflicting = await this.ds.query(
        `SELECT sb.id, sb.medicine_id, m.brand_name
         FROM stock_batches sb
         JOIN medicines m ON m.id = sb.medicine_id
         WHERE sb.batch_number=$1 AND sb.medicine_id != $2 AND sb.tenant_id=$3
         LIMIT 1`,
        [batchNo, medId, TENANT]
      );

      if (conflicting.length > 0) {
        batchConflicts.push({
          batch_number: batchNo,
          csv_medicine: name,
          existing_medicine: conflicting[0].brand_name,
          action: 'skipped',
        });
        continue; // Skip this batch - it's a duplicate across different medicines
      }

      if (existing.length > 0) {
        await this.ds.query(`
          UPDATE stock_batches SET
            quantity        = $1,
            purchase_price  = COALESCE($2, purchase_price),
            mrp             = $3,
            sale_rate       = $3,
            free_qty        = $4,
            batch_qty       = $5,
            discount_amount = $6,
            tax_amount      = $7,
            purchase_value  = $8,
            updated_at      = NOW()
          WHERE id = $9
        `, [qty, cost, mrp, freeQty, batchQty, discAmt, taxAmt, purVal, existing[0].id]);
        batchUpdated++;
      } else {
        await this.ds.query(`
          INSERT INTO stock_batches (
            medicine_id, batch_number, expiry_date, quantity,
            purchase_price, mrp, sale_rate, purchase_invoice_no,
            free_qty, batch_qty, discount_amount, tax_amount, purchase_value,
            is_active, verification_status, tenant_id, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $6, $7,
            $8, $9, $10, $11, $12,
            true, 'verified', $13, NOW(), NOW()
          )
        `, [medId, batchNo, exp, qty,
            cost, mrp, invoiceNo,
            freeQty, batchQty, discAmt, taxAmt, purVal, TENANT]);
        batchInserted++;
      }
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    const [{ count: medCount }]   = await this.ds.query(
      `SELECT COUNT(*) FROM medicines WHERE tenant_id=$1`, [TENANT]
    );
    const [{ count: batchCount }] = await this.ds.query(
      `SELECT COUNT(*) FROM stock_batches WHERE tenant_id=$1 AND quantity>0`, [TENANT]
    );

    return {
      status: 'success',
      medicines: { 
        inserted: medInserted, 
        updated: medUpdated, 
        fuzzy_matched: medMatched,
        total: medCount 
      },
      batches: { 
        inserted: batchInserted, 
        updated: batchUpdated, 
        conflicts_skipped: batchConflicts.length,
        total: batchCount 
      },
      warnings: {
        fuzzy_matches: matchLog,
        batch_conflicts: batchConflicts,
      },
    };
  }
}
