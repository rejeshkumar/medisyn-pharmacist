// ============================================================
// apps/api/src/medicines/molecule-suggestions.controller.ts
// ============================================================
// Handles pharmacist approval workflow for Kaggle-matched suggestions
// ============================================================

import { Controller, Get, Patch, Param, Body, Req, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';

@Controller('medicines/suggestions')
@UseGuards(JwtAuthGuard)
export class MoleculeSuggestionsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── GET /medicines/suggestions — list pending suggestions ─────────────────
  @Get()
  async list(
    @Req() req: any,
    @Query('status') status = 'pending',
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
    @Query('min_score') minScore = '70',
  ) {
    const tenantId = req.tenantId;

    const rows = await this.ds.query(`
      SELECT
        ms.id,
        ms.medicine_id,
        ms.matched_name,
        ms.match_score,
        ms.suggested_category,
        ms.suggested_use,
        ms.suggested_schedule,
        ms.suggested_subs,
        ms.chemical_class,
        ms.side_effects,
        ms.status,
        ms.reviewer_notes,
        ms.created_at,
        m.brand_name,
        m.molecule,
        m.strength,
        m.schedule_class,
        m.category,
        m.dosage_form,
        m.manufacturer
      FROM molecule_suggestions ms
      JOIN medicines m ON m.id = ms.medicine_id
      WHERE ms.tenant_id = $1
        AND ms.status = $2
        AND ms.match_score >= $3
      ORDER BY ms.match_score DESC
      LIMIT $4 OFFSET $5
    `, [tenantId, status, parseFloat(minScore), parseInt(limit), parseInt(offset)]);

    const [{ count }] = await this.ds.query(`
      SELECT COUNT(*) FROM molecule_suggestions
      WHERE tenant_id = $1 AND status = $2 AND match_score >= $3
    `, [tenantId, status, parseFloat(minScore)]);

    // Summary stats
    const stats = await this.ds.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE match_score >= 80 AND status = 'pending') AS high_confidence,
        COUNT(*) FILTER (WHERE match_score < 80 AND status = 'pending')  AS needs_review
      FROM molecule_suggestions
      WHERE tenant_id = $1
    `, [tenantId]);

    return { rows, total: parseInt(count), stats: stats[0] };
  }

  // ── PATCH /medicines/suggestions/:id/approve ──────────────────────────────
  @Patch(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: {
      category?: string;
      schedule?: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const userId   = req.user.id;

    // Get suggestion
    const [suggestion] = await this.ds.query(`
      SELECT * FROM molecule_suggestions WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    if (!suggestion) throw new Error('Suggestion not found');

    const category = body.category || suggestion.suggested_category;
    const schedule = body.schedule || suggestion.suggested_schedule;

    // Apply to medicines table
    await this.ds.query(`
      UPDATE medicines SET
        category        = COALESCE($1, category),
        schedule_class  = COALESCE($2::medicines_schedule_class_enum, schedule_class),
        treatment_for   = COALESCE($3, treatment_for),
        updated_at      = NOW()
      WHERE id = $4
    `, [category, schedule, suggestion.suggested_use, suggestion.medicine_id]);

    // Mark suggestion as approved
    await this.ds.query(`
      UPDATE molecule_suggestions SET
        status           = 'approved',
        applied_category = $1,
        applied_schedule = $2,
        reviewed_by      = $3,
        reviewed_at      = NOW(),
        reviewer_notes   = $4,
        updated_at       = NOW()
      WHERE id = $5
    `, [category, schedule, userId, body.notes || null, id]);

    return { success: true, applied: { category, schedule } };
  }

  // ── PATCH /medicines/suggestions/:id/reject ───────────────────────────────
  @Patch(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const userId   = req.user.id;

    await this.ds.query(`
      UPDATE molecule_suggestions SET
        status        = 'rejected',
        reviewed_by   = $1,
        reviewed_at   = NOW(),
        reviewer_notes= $2,
        updated_at    = NOW()
      WHERE id = $3 AND tenant_id = $4
    `, [userId, body.notes || null, id, tenantId]);

    return { success: true };
  }

  // ── PATCH /medicines/suggestions/bulk-approve ─────────────────────────────
  // Bulk approve all high-confidence suggestions (score >= 85)
  @Patch('bulk-approve')
  async bulkApprove(
    @Body() body: { min_score?: number; notes?: string },
    @Req() req: any,
  ) {
    const tenantId = req.tenantId;
    const userId   = req.user.id;
    const minScore = body.min_score || 85;

    // Get all pending high-confidence suggestions
    const suggestions = await this.ds.query(`
      SELECT ms.*, m.id AS med_id
      FROM molecule_suggestions ms
      JOIN medicines m ON m.id = ms.medicine_id
      WHERE ms.tenant_id = $1
        AND ms.status = 'pending'
        AND ms.match_score >= $2
    `, [tenantId, minScore]);

    let applied = 0;
    for (const s of suggestions) {
      await this.ds.query(`
        UPDATE medicines SET
          category       = COALESCE($1, category),
          schedule_class = COALESCE($2::medicines_schedule_class_enum, schedule_class),
          treatment_for  = COALESCE($3, treatment_for),
          updated_at     = NOW()
        WHERE id = $4
      `, [s.suggested_category, s.suggested_schedule, s.suggested_use, s.medicine_id]);

      await this.ds.query(`
        UPDATE molecule_suggestions SET
          status           = 'approved',
          applied_category = suggested_category,
          applied_schedule = suggested_schedule,
          reviewed_by      = $1,
          reviewed_at      = NOW(),
          reviewer_notes   = $2,
          updated_at       = NOW()
        WHERE id = $3
      `, [userId, `Bulk approved (score ≥ ${minScore}%)`, s.id]);

      applied++;
    }

    return { success: true, applied, min_score: minScore };
  }
}
