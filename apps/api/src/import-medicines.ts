import { Client } from 'pg';
import * as https from 'https';

const DB_URL = process.env.DATABASE_URL!.replace('postgresql+asyncpg://', 'postgresql://').split('?')[0];
const DATASET_URL = 'https://raw.githubusercontent.com/junioralive/Indian-Medicine-Dataset/main/DATA/indian_medicine_data.json';
const BATCH_SIZE = 500;

function download(): Promise<any[]> {
  return new Promise((resolve, reject) => {
    https.get(DATASET_URL, { headers: { 'User-Agent': 'MediSyn/1.0' } }, (res) => {
      let raw = '';
      res.on('data', (d: any) => raw += d);
      res.on('end', () => resolve(JSON.parse(raw)));
    }).on('error', reject);
  });
}

function normalize(t: string) { return t?.toLowerCase().trim() || null; }

async function main() {
  console.log('Connecting to DB...');
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('Connected');

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    DROP TABLE IF EXISTS medicine_reference CASCADE;
    CREATE TABLE medicine_reference (
      id serial PRIMARY KEY, name varchar(500) NOT NULL,
      name_normalized varchar(500), composition1 varchar(500),
      composition2 varchar(500), manufacturer varchar(300),
      pack_size varchar(200), mrp numeric(10,2),
      medicine_type varchar(50), is_discontinued boolean DEFAULT false,
      created_at timestamptz DEFAULT NOW());
    CREATE INDEX idx_medref_name_trgm ON medicine_reference USING GIN (name_normalized gin_trgm_ops);
    CREATE INDEX idx_medref_comp1_trgm ON medicine_reference USING GIN (composition1 gin_trgm_ops);
  `);
  console.log('Table ready');

  console.log('Downloading dataset...');
  const data = await download();
  console.log('Downloaded ' + data.length + ' medicines');

  let inserted = 0;
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const rows = batch.filter((r: any) => r.name?.trim()).map((r: any) => {
      const mrp = parseFloat(String(r['price(₹)'] || '0').replace(',', '')) || null;
      const disc = String(r.Is_discontinued || 'FALSE').toUpperCase() === 'TRUE';
      return [r.name.trim(), normalize(r.name), normalize(r.short_composition1 || ''),
        normalize(r.short_composition2 || ''), r.manufacturer_name?.trim() || null,
        r.pack_size_label?.trim() || null, mrp, (r.type || 'allopathy').toLowerCase(), disc];
    });
    if (rows.length) {
      const placeholders = rows.map((_: any, ri: number) => {
        const b = ri * 9;
        return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`;
      }).join(',');
      await client.query(
        `INSERT INTO medicine_reference (name,name_normalized,composition1,composition2,manufacturer,pack_size,mrp,medicine_type,is_discontinued) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
        rows.flat()
      );
      inserted += rows.length;
    }
    process.stdout.write('\r' + inserted + ' inserted...');
  }

  const res = await client.query('SELECT COUNT(*) FROM medicine_reference');
  console.log('\nDone — ' + res.rows[0].count + ' medicines in DB');
  await client.end();
}

main().catch((e: any) => { console.error('FAILED:', e.message); process.exit(1); });
