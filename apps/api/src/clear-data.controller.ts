import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('admin')
export class ClearDataController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('clear-medicines')
  async clear(@Headers('x-admin-key') key: string) {
    if (key !== 'medisyn-import-2024') throw new ForbiddenException();
    const TENANT = '00000000-0000-0000-0000-000000000001';
    const tables = [
      'refill_followups','medication_plans','demand_requests',
      'credit_note_items','schedule_drug_logs','sale_items',
      'sales','purchase_order_items','reorder_flags',
      'prescription_items'
    ];
    const results: any = {};
    for (const table of tables) {
      try {
        const r = await this.ds.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [TENANT]);
        results[table] = r[1] ?? 'ok';
      } catch(e: any) {
        results[table] = `error: ${e.message}`;
      }
    }
    const [{ count }] = await this.ds.query(`SELECT COUNT(*) FROM medicines WHERE tenant_id = $1`, [TENANT]);
    return { results, medicines_remaining: count };
  }
}
