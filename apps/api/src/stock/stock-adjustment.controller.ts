// ── stock-adjustment.controller.ts ────────────────────────────────────────
import {
  Controller, Get, Post, Body, Query, Req, UseGuards,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

const ALLOWED_ROLES = ['owner', 'pharmacist'];

@Controller('stock-adjustments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StockAdjustmentController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── GET /stock-adjustments ─────────────────────────────────
  @Get()
  async list(@Query() q: any, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const params: any[] = [tenantId];
    const where: string[] = [];

    if (q.type)        { params.push(q.type);        where.push(`a.adjustment_type = $${params.length}`); }
    if (q.medicine_id) { params.push(q.medicine_id); where.push(`a.medicine_id = $${params.length}`); }
    if (q.from)        { params.push(q.from);         where.push(`a.created_at >= $${params.length}`); }
    if (q.to)          { params.push(q.to + ' 23:59:59'); where.push(`a.created_at <= $${params.length}`); }

    const whereClause = where.length ? 'AND ' + where.join(' AND ') : '';

    return this.ds.query(
      `SELECT
         a.*,
         m.brand_name, m.molecule, m.strength, m.schedule_class,
         sb.batch_number, sb.expiry_date
       FROM stock_adjustments a
       JOIN medicines m ON m.id = a.medicine_id
       JOIN stock_batches sb ON sb.id = a.batch_id
       WHERE a.tenant_id = $1 ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT 200`,
      params,
    );
  }

  // ── GET /stock-adjustments/summary ────────────────────────
  @Get('summary')
  async summary(@Query('from') from: string, @Query('to') to: string, @Req() req: any) {
    const tenantId = req.user.tenant_id;
    const f = from || new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const t = to   || new Date().toISOString().split('T')[0];
    return this.ds.query(
      `SELECT
         adjustment_type,
         COUNT(*)::int            AS count,
         SUM(qty_adjusted)::int   AS total_qty,
         COUNT(*) FILTER (WHERE requires_compliance AND NOT compliance_noted)::int AS pending_compliance
       FROM stock_adjustments
       WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
       GROUP BY adjustment_type
       ORDER BY count DESC`,
      [tenantId, f, t + ' 23:59:59'],
    );
  }

  // ── POST /stock-adjustments ────────────────────────────────
  @Post()
  async create(@Body() dto: any, @Req() req: any) {
    const { tenant_id, sub: userId, role, full_name } = req.user;

    // Role check
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException('Only owner or pharmacist can make stock adjustments');
    }

    // Validate required fields
    if (!dto.batch_id)         throw new BadRequestException('batch_id is required');
    if (!dto.adjustment_type)  throw new BadRequestException('adjustment_type is required');
    if (!dto.qty_adjusted || dto.qty_adjusted <= 0)
                               throw new BadRequestException('qty_adjusted must be > 0');
    if (!dto.reason?.trim())   throw new BadRequestException('reason is mandatory');

    // Determine direction
    const direction = ['patient_return', 'count_correction_up'].includes(dto.adjustment_type)
      ? 'increase'
      : 'decrease';

    // Override direction if explicitly provided
    const finalDirection = dto.direction || direction;

    const qr = this.ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();

    try {
      // Lock the batch row
      const batch = await qr.query(
        `SELECT sb.*, m.brand_name, m.schedule_class, m.id AS med_id
         FROM stock_batches sb
         JOIN medicines m ON m.id = sb.medicine_id
         WHERE sb.id = $1 AND sb.tenant_id = $2
         FOR UPDATE`,
        [dto.batch_id, tenant_id],
      );

      if (!batch[0]) throw new BadRequestException('Batch not found');

      const b           = batch[0];
      const qtyBefore   = Number(b.quantity);
      const qtyChange   = Number(dto.qty_adjusted);

      // Calculate new quantity
      const qtyAfter = finalDirection === 'increase'
        ? qtyBefore + qtyChange
        : qtyBefore - qtyChange;

      // Prevent negative stock (unless count correction)
      if (qtyAfter < 0 && dto.adjustment_type !== 'count_correction') {
        throw new BadRequestException(
          `Cannot reduce stock below 0. Current stock: ${qtyBefore}, requested reduction: ${qtyChange}`
        );
      }

      const finalQty = Math.max(0, qtyAfter);

      // Schedule compliance check
      const needsCompliance = ['H', 'H1', 'X'].includes(b.schedule_class)
        && dto.adjustment_type === 'return_to_distributor';

      // Update batch quantity
      await qr.query(
        `UPDATE stock_batches SET quantity = $1, updated_at = NOW()
         WHERE id = $2`,
        [finalQty, dto.batch_id],
      );

      // If batch fully depleted by return, mark inactive
      if (finalQty === 0 && finalDirection === 'decrease') {
        await qr.query(
          `UPDATE stock_batches SET is_active = false, updated_at = NOW()
           WHERE id = $1`,
          [dto.batch_id],
        );
      }

      // Create adjustment record
      const adj = await qr.query(
        `INSERT INTO stock_adjustments (
           tenant_id, batch_id, medicine_id, adjustment_type, direction,
           qty_adjusted, qty_before, qty_after,
           reason, distributor_name, distributor_ref,
           damage_cause, original_sale_id, patient_name,
           schedule_class, requires_compliance, compliance_noted,
           adjusted_by, adjusted_by_name, notes
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [
          tenant_id, dto.batch_id, b.med_id, dto.adjustment_type, finalDirection,
          qtyChange, qtyBefore, finalQty,
          dto.reason.trim(),
          dto.distributor_name   || null,
          dto.distributor_ref    || null,
          dto.damage_cause       || null,
          dto.original_sale_id   || null,
          dto.patient_name       || null,
          b.schedule_class,
          needsCompliance,
          dto.compliance_noted   ?? false,
          userId, full_name || 'Unknown',
          dto.notes              || null,
        ],
      );

      // Audit log
      await qr.query(
        `INSERT INTO audit_logs (
           action, entity, entity_id, entity_ref,
           user_id, user_name, user_role,
           before_value, after_value, tenant_id
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10)`,
        [
          'STOCK_ADJUSTMENT', 'stock_batches', dto.batch_id,
          `${b.brand_name} Batch ${b.batch_number}`,
          userId, full_name || 'Unknown', role,
          JSON.stringify({ quantity: qtyBefore }),
          JSON.stringify({ quantity: finalQty, adjustment_type: dto.adjustment_type, reason: dto.reason }),
          tenant_id,
        ],
      );

      await qr.commitTransaction();

      return {
        id:                adj[0].id,
        medicine:          b.brand_name,
        batch:             b.batch_number,
        adjustment_type:   dto.adjustment_type,
        direction:         finalDirection,
        qty_before:        qtyBefore,
        qty_adjusted:      qtyChange,
        qty_after:         finalQty,
        requires_compliance: needsCompliance,
        message:           `Stock ${finalDirection === 'increase' ? 'increased' : 'decreased'} from ${qtyBefore} to ${finalQty}`,
      };

    } catch (e) {
      await qr.rollbackTransaction();
      throw e;
    } finally {
      await qr.release();
    }
  }
}
