import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('draft-bills')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DraftBillsController {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  @Get()
  list(@Req() req: any) {
    return this.dataSource.query(
      `SELECT id, label, cart_data, compliance, payment_mode,
              discount, status, created_at, updated_at
       FROM draft_bills
       WHERE tenant_id = $1 AND created_by = $2 AND status = 'draft'
       ORDER BY updated_at DESC`,
      [req.user.tenant_id, req.user.sub],
    );
  }

  @Post()
  async create(@Body() body: any, @Req() req: any) {
    const r = await this.dataSource.query(
      `INSERT INTO draft_bills
         (tenant_id, created_by, label, cart_data, compliance,
          payment_mode, discount)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,$7)
       RETURNING id, label, created_at`,
      [
        req.user.tenant_id,
        req.user.sub,
        body.label || 'Unnamed bill',
        JSON.stringify(body.cart_data || []),
        JSON.stringify(body.compliance || {}),
        body.payment_mode || 'cash',
        body.discount || 0,
      ],
    );
    return r[0];
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    await this.dataSource.query(
      `UPDATE draft_bills
       SET label        = COALESCE($1, label),
           cart_data    = COALESCE($2::jsonb, cart_data),
           compliance   = COALESCE($3::jsonb, compliance),
           payment_mode = COALESCE($4, payment_mode),
           discount     = COALESCE($5, discount),
           updated_at   = NOW()
       WHERE id = $6 AND tenant_id = $7 AND created_by = $8`,
      [
        body.label        ?? null,
        body.cart_data    ? JSON.stringify(body.cart_data) : null,
        body.compliance   ? JSON.stringify(body.compliance) : null,
        body.payment_mode ?? null,
        body.discount     ?? null,
        id,
        req.user.tenant_id,
        req.user.sub,
      ],
    );
    return { ok: true };
  }

  @Delete(':id')
  async abandon(@Param('id') id: string, @Req() req: any) {
    await this.dataSource.query(
      `UPDATE draft_bills SET status = 'abandoned', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND created_by = $3`,
      [id, req.user.tenant_id, req.user.sub],
    );
    return { ok: true };
  }

  @Patch(':id/confirm')
  async confirm(@Param('id') id: string, @Req() req: any) {
    await this.dataSource.query(
      `UPDATE draft_bills SET status = 'confirmed', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2`,
      [id, req.user.tenant_id],
    );
    return { ok: true };
  }
}
