import { Controller, Post, Headers, ForbiddenException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as XLSX from 'xlsx';

const TENANT = '00000000-0000-0000-0000-000000000001';

@Controller('admin')
export class ImportStockController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('import-stock')
  @UseInterceptors(FileInterceptor('file'))
  async importStock(
    @Headers('x-admin-key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (key !== 'medisyn-import-2024') throw new ForbiddenException();

    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Find header row
    let headerIdx = 0;
    for (let i = 0; i < 10; i++) {
      if (rows[i]?.includes('Drug Name')) { headerIdx = i; break; }
    }
    const headers = rows[headerIdx];
    const data = rows.slice(headerIdx + 1).map(row => {
      const obj: any = {};
      headers.forEach((h: string, i: number) => { obj[h] = row[i]; });
      return obj;
    });

    const stockRows = data.filter(r => r['Drug Name'] && Number(r['Avail Qty'] || 0) > 0);
    let medInserted = 0, medUpdated = 0, batchInserted = 0;

    const inferDosage = (name: string) => {
      const n = (name || '').toUpperCase();
      if (n.startsWith('TAB ')) return 'tablet';
      if (n.startsWith('CAP ')) return 'capsule';
      if (n.startsWith('SYP ') || n.startsWith('SYR ')) return 'syrup';
      if (n.startsWith('INJ ')) return 'injection';
      if (n.includes('CREAM')) return 'cream';
      if (n.includes('OINT')) return 'ointment';
      if (n.includes('GEL')) return 'gel';
      if (n.includes('DROP')) return 'drops';
      if (n.includes('SPRAY')) return 'spray';
      if (n.includes('PASTE')) return 'paste';
      if (n.includes('POWDER') || n.includes('PDR')) return 'powder';
      if (n.includes('SACHET')) return 'sachet';
      if (n.includes('SUSP')) return 'suspension';
      if (n.includes('LOTION')) return 'lotion';
      return 'other';
    };

    const parseExpiry = (val: any) => {
      if (!val) return null;
      const s = String(val).trim();
      const months: any = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
      const m = s.match(/^([A-Za-z]{3})-(\d{2,4})$/);
      if (m) {
        const mon = months[m[1]] || 1;
        const yr = m[2].length === 2 ? 2000 + parseInt(m[2]) : parseInt(m[2]);
        const lastDay = new Date(yr, mon, 0).getDate();
        return `${yr}-${String(mon).padStart(2,'0')}-${String(lastDay).padStart(2,'0')}`;
      }
      return null;
    };

    const num = (v: any) => {
      const n = parseFloat(String(v || '').replace(',',''));
      return isNaN(n) || n < 0 ? null : n;
    };

    const gst = (v: any) => { const n = num(v); return n !== null && n <= 100 ? n : null; };

    // Group by drug name for medicine upsert
    const medMap = new Map<string, string>();
    const uniqueMeds = new Map<string, any>();
    for (const row of stockRows) {
      const name = String(row['Drug Name']).trim();
      if (!uniqueMeds.has(name)) uniqueMeds.set(name, row);
    }

    for (const [name, row] of uniqueMeds) {
      const mrp = num(row['Mrp']);
      const existing = await this.ds.query(
        `SELECT id FROM medicines WHERE LOWER(TRIM(brand_name)) = LOWER($1) AND tenant_id = $2 LIMIT 1`,
        [name, TENANT]
      );
      if (existing.length > 0) {
        const id = existing[0].id;
        await this.ds.query(
          `UPDATE medicines SET manufacturer=COALESCE($1,manufacturer), mrp=COALESCE($2,mrp), gst_percent=COALESCE($3,gst_percent), tabs_per_strip=COALESCE($4,tabs_per_strip), updated_at=NOW() WHERE id=$5`,
          [String(row['Mfg Name']||'').trim()||null, mrp, gst(row['Tax%']), num(row['Strip Qty']), id]
        );
        medMap.set(name, id);
        medUpdated++;
      } else {
        const res = await this.ds.query(
          `INSERT INTO medicines (brand_name,molecule,manufacturer,hsn_code,mrp,sale_rate,gst_percent,tabs_per_strip,dosage_form,is_active,is_rx_required,tenant_id,created_at,updated_at)
           VALUES ($1,'',$2,$3,$4,$5,$6,$7,$8,true,false,$9,NOW(),NOW()) RETURNING id`,
          [name, String(row['Mfg Name']||'').trim()||null, String(row['HSN Code']||'').trim()||null,
           mrp, mrp, gst(row['Tax%']), num(row['Strip Qty']), inferDosage(name), TENANT]
        );
        medMap.set(name, res[0].id);
        medInserted++;
      }
    }

    // Insert batches
    for (const row of stockRows) {
      const name = String(row['Drug Name']).trim();
      const medId = medMap.get(name);
      if (!medId) continue;
      const batchNo = String(row['Batch No']||'').trim() || null;
      const existing = await this.ds.query(
        `SELECT id FROM stock_batches WHERE medicine_id=$1 AND batch_number=$2 AND tenant_id=$3 LIMIT 1`,
        [medId, batchNo, TENANT]
      );
      if (existing.length > 0) {
        await this.ds.query(
          `UPDATE stock_batches SET quantity=$1,purchase_price=COALESCE($2,purchase_price),mrp=COALESCE($3,mrp),free_qty=$4,batch_qty=$5,discount_amount=$6,tax_amount=$7,purchase_value=$8,updated_at=NOW() WHERE id=$9`,
          [num(row['Avail Qty']), num(row['Rate']), num(row['Mrp']), num(row['Free Qty']), num(row['Batch Qty']), num(row['Discount Amount']), num(row['Tax Amount']), num(row['Purchase Value']), existing[0].id]
        );
      } else {
        await this.ds.query(
          `INSERT INTO stock_batches (medicine_id,batch_number,expiry_date,quantity,purchase_price,mrp,purchase_invoice_no,free_qty,batch_qty,discount_amount,tax_amount,purchase_value,is_active,tenant_id,created_at,updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,true,$13,NOW(),NOW())`,
          [medId, batchNo, parseExpiry(row['Expiry By']), num(row['Avail Qty']), num(row['Rate']),
           num(row['Mrp']), String(row['Invoice No']||'').trim()||null,
           num(row['Free Qty']), num(row['Batch Qty']), num(row['Discount Amount']),
           num(row['Tax Amount']), num(row['Purchase Value']), TENANT]
        );
        batchInserted++;
      }
    }

    const [{ count }] = await this.ds.query(`SELECT COUNT(*) FROM medicines WHERE tenant_id=$1`, [TENANT]);
    const [{ count: bcount }] = await this.ds.query(`SELECT COUNT(*) FROM stock_batches WHERE tenant_id=$1 AND quantity>0`, [TENANT]);

    return { medInserted, medUpdated, batchInserted, total_medicines: count, live_batches: bcount };
  }
}
// force rebuild Sun Apr 26 20:16:05 IST 2026
