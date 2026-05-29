import { Controller, Post, Headers, ForbiddenException } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const TENANT = '00000000-0000-0000-0000-000000000001';

@Controller('admin')
export class SetReorderController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('set-reorder-thresholds')
  async set(@Headers('x-admin-key') key: string) {
    const adminKey = process.env.ADMIN_IMPORT_KEY;
    if (!adminKey || key !== adminKey) throw new ForbiddenException();

    // Strip medicines — reorder at 2 strips
    const r1 = await this.ds.query(`
      UPDATE medicines SET reorder_qty = tabs_per_strip * 2
      WHERE tenant_id = $1 AND tabs_per_strip > 1 AND reorder_qty = 0
    `, [TENANT]);

    // Single unit medicines — reorder at 5
    const r2 = await this.ds.query(`
      UPDATE medicines SET reorder_qty = 5
      WHERE tenant_id = $1 AND (tabs_per_strip IS NULL OR tabs_per_strip <= 1) AND reorder_qty = 0
    `, [TENANT]);

    const [{ count: zero }] = await this.ds.query(`
      SELECT COUNT(*) FROM medicines WHERE tenant_id = $1 AND reorder_qty = 0
    `, [TENANT]);

    const [{ count: set }] = await this.ds.query(`
      SELECT COUNT(*) FROM medicines WHERE tenant_id = $1 AND reorder_qty > 0
    `, [TENANT]);

    return { strip_medicines_updated: r1[1], single_unit_updated: r2[1], still_zero: zero, has_threshold: set };
  }
}
