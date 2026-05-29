import { Controller, Post, Headers, ForbiddenException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const TENANT = '00000000-0000-0000-0000-000000000001';

@Controller('admin')
export class KaggleImportController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Public()
  @Post('kaggle-import')
  @UseInterceptors(FileInterceptor('file'))
  async importKaggle(
    @Headers('x-admin-key') key: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const adminKey = process.env.ADMIN_IMPORT_KEY;
    if (!adminKey || key !== adminKey) throw new ForbiddenException();

    const matches = JSON.parse(file.buffer.toString('utf-8'));
    let saved = 0;

    for (const m of matches) {
      await this.ds.query(`
        INSERT INTO molecule_suggestions (
          medicine_id, tenant_id, matched_name, match_score,
          suggested_category, suggested_use, suggested_schedule,
          suggested_subs, chemical_class, side_effects,
          status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW(),NOW())
        ON CONFLICT (medicine_id, tenant_id) DO UPDATE SET
          matched_name=EXCLUDED.matched_name,
          match_score=EXCLUDED.match_score,
          suggested_category=EXCLUDED.suggested_category,
          suggested_use=EXCLUDED.suggested_use,
          suggested_schedule=EXCLUDED.suggested_schedule,
          suggested_subs=EXCLUDED.suggested_subs,
          chemical_class=EXCLUDED.chemical_class,
          side_effects=EXCLUDED.side_effects,
          status='pending', updated_at=NOW()
      `, [m.id, TENANT, m.matched, m.score, m.category, m.use,
          m.schedule, m.subs || [], m.chem, m.effects || []]);
      saved++;
    }

    const [{ count }] = await this.ds.query(
      `SELECT COUNT(*) FROM molecule_suggestions WHERE tenant_id=$1 AND status='pending'`,
      [TENANT]
    );

    const [{ high }] = await this.ds.query(
      `SELECT COUNT(*) AS high FROM molecule_suggestions WHERE tenant_id=$1 AND status='pending' AND match_score >= 85`,
      [TENANT]
    );

    return { saved, pending: count, high_confidence: high };
  }
}
