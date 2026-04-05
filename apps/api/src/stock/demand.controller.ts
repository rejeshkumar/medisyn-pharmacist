// demand.controller.ts
// Place at: apps/api/src/procurement/demand.controller.ts
// Add to procurement module

import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('demand')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DemandController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Record a demand request ───────────────────────────────────────────────
  @Post()
  async recordDemand(
    @Body() body: { medicine_id?: string; medicine_name: string; notes?: string },
    @Req() req: any,
  ) {
    const { tenant_id, sub: userId, name: userName } = req.user;

    await this.ds.query(
      `INSERT INTO demand_requests
         (tenant_id, medicine_id, medicine_name, requested_by, requested_by_name, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant_id, body.medicine_id || null, body.medicine_name, userId, userName || '', body.notes || null]
    );

    // Check if threshold reached (3 requests) — return flag so UI can show alert
    const count = await this.ds.query(
      `SELECT COUNT(*)::int as cnt FROM demand_requests
       WHERE tenant_id=$1 AND medicine_name ILIKE $2 AND status='pending'`,
      [tenant_id, body.medicine_name]
    );

    const total = count[0]?.cnt || 1;
    return {
      recorded: true,
      total_requests: total,
      is_high_demand: total >= 3,
      message: total >= 3
        ? `High demand: ${body.medicine_name} requested ${total} times — consider procuring`
        : `Demand noted (${total} request${total > 1 ? 's' : ''})`,
    };
  }

  // ── Get demand summary ────────────────────────────────────────────────────
  @Get()
  async getDemandSummary(
    @Query('threshold') threshold: string,
    @Query('days') days: string,
    @Req() req: any,
  ) {
    const tenantId  = req.user.tenant_id;
    const thresh    = parseInt(threshold) || 3;
    const daysBack  = parseInt(days) || 30;

    const rows = await this.ds.query(
      `SELECT
         dr.medicine_id,
         dr.medicine_name,
         COUNT(*)::int                                                    AS request_count,
         COUNT(*) FILTER (WHERE dr.created_at > NOW() - ($3||' days')::interval)::int
                                                                          AS requests_recent,
         MAX(dr.created_at)                                               AS last_requested,
         CASE WHEN COUNT(*) >= $2 THEN true ELSE false END                AS is_high_demand,
         m.brand_name,
         m.molecule,
         m.dosage_form,
         COALESCE((
           SELECT SUM(sb.quantity) FROM stock_batches sb
           WHERE sb.medicine_id = dr.medicine_id AND sb.tenant_id = $1
             AND sb.quantity > 0 AND sb.expiry_date > CURRENT_DATE
         ), 0)::int AS current_stock,
         m.reorder_qty,
         -- Check if already in reorder list
         EXISTS (
           SELECT 1 FROM reorder_flags rf
           WHERE rf.medicine_id = dr.medicine_id
             AND rf.tenant_id = $1 AND rf.status = 'pending'
         ) AS already_in_reorder
       FROM demand_requests dr
       LEFT JOIN medicines m ON m.id = dr.medicine_id AND m.tenant_id = $1
       WHERE dr.tenant_id = $1 AND dr.status = 'pending'
       GROUP BY dr.medicine_id, dr.medicine_name, m.brand_name, m.molecule,
                m.dosage_form, m.reorder_qty
       ORDER BY request_count DESC, last_requested DESC`,
      [tenantId, thresh, daysBack]
    );

    return {
      threshold:   thresh,
      total:       rows.length,
      high_demand: rows.filter((r: any) => r.is_high_demand),
      all:         rows,
    };
  }

  // ── Mark as ordered / fulfilled ───────────────────────────────────────────
  @Post('fulfil')
  async markFulfilled(
    @Body() body: { medicine_name: string; status: 'ordered' | 'fulfilled' },
    @Req() req: any,
  ) {
    await this.ds.query(
      `UPDATE demand_requests SET status=$1
       WHERE tenant_id=$2 AND medicine_name ILIKE $3 AND status='pending'`,
      [body.status, req.user.tenant_id, body.medicine_name]
    );
    return { updated: true };
  }
}
