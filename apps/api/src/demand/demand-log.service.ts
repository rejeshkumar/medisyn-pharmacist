// ============================================================
// apps/api/src/demand/demand-log.service.ts
// ============================================================
// Three-layer validation:
//   Layer 1 — fuzzy match against medicines table (free)
//   Layer 2 — match against molecules / JA list (free)
//   Layer 3 — Claude Haiku API (only if both miss, ~₹0.02/call)
// ============================================================
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface LogDemandDto {
  medicine_name_raw: string;
  qty_requested?: string;
  has_prescription?: boolean;
  patient_mobile?: string;
  patient_name?: string;
}

export interface ValidationResult {
  status: 'validated' | 'misspelling' | 'not_a_medicine' | 'pending';
  source: 'db_match' | 'ja_match' | 'claude_api' | 'manual';
  inn_name?: string;
  suggested_name?: string;
  dosage_form?: string;
  schedule_class?: string;
  is_nti?: boolean;
  medicine_id?: string;
  notes?: string;
}

@Injectable()
export class DemandLogService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Layer 1: Fuzzy match against medicines table ──────────────────────
  private async matchDB(name: string, tenantId: string): Promise<ValidationResult | null> {
    const rows = await this.db.query(
      `SELECT id, brand_name, molecule AS inn_name, dosage_form,
              schedule_class::text AS schedule_class,
              similarity(LOWER(brand_name), LOWER($1)) AS score
       FROM medicines
       WHERE tenant_id = $2
         AND is_active = true
         AND (
           LOWER(brand_name) LIKE LOWER($3)
           OR brand_name % $1
           OR LOWER(molecule) LIKE LOWER($3)
         )
       ORDER BY score DESC
       LIMIT 1`,
      [name, tenantId, `%${name}%`]
    ).catch(() => []);

    if (!rows?.length) return null;
    const r = rows[0];
    const score = parseFloat(r.score);
    if (score < 0.3) return null;

    const isExact = r.brand_name.toLowerCase() === name.toLowerCase();
    return {
      status: isExact ? 'validated' : 'misspelling',
      source: 'db_match',
      inn_name: r.inn_name,
      suggested_name: isExact ? undefined : r.brand_name,
      dosage_form: r.dosage_form,
      schedule_class: r.schedule_class,
      medicine_id: r.id,
    };
  }

  // ── Layer 2: Match against molecules/JA list ──────────────────────────
  private async matchJA(name: string, tenantId: string): Promise<ValidationResult | null> {
    const rows = await this.db.query(
      `SELECT inn_name, dosage_form, schedule, is_nti,
              similarity(LOWER(inn_name), LOWER($1)) AS score
       FROM molecules
       WHERE tenant_id = $2
         AND (
           LOWER(inn_name) LIKE LOWER($3)
           OR inn_name % $1
           OR LOWER(normalized_name) LIKE LOWER($3)
         )
       ORDER BY score DESC
       LIMIT 1`,
      [name, tenantId, `%${name}%`]
    ).catch(() => []);

    if (!rows?.length) return null;
    const r = rows[0];
    if (parseFloat(r.score) < 0.25) return null;

    return {
      status: 'validated',
      source: 'ja_match',
      inn_name: r.inn_name,
      dosage_form: r.dosage_form,
      schedule_class: r.schedule,
      is_nti: r.is_nti,
    };
  }

  // ── Layer 3: Claude Haiku API validation ──────────────────────────────
  private async validateViaClaude(name: string): Promise<ValidationResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { status: 'pending', source: 'claude_api', notes: 'API key not configured' };
    }

    const prompt = `You are a pharmacist in India. A patient asked for a medicine called "${name}".

Determine if this is a real medicine available in India. Return ONLY valid JSON, no explanation:

{
  "is_real_medicine": true/false,
  "inn_name": "INN/generic name or null",
  "brand_name_corrected": "correct spelling if misspelled, else null",
  "dosage_form": "tablet/capsule/syrup/injection/cream/etc or null",
  "schedule_class": "OTC/H/H1/X or null",
  "is_nti": true/false,
  "reason": "brief reason if not a real medicine"
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await res.json();
      const text = data.content?.[0]?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());

      if (!parsed.is_real_medicine) {
        return {
          status: 'not_a_medicine',
          source: 'claude_api',
          notes: parsed.reason || 'Not a recognised medicine in India',
        };
      }

      return {
        status: parsed.brand_name_corrected ? 'misspelling' : 'validated',
        source: 'claude_api',
        inn_name: parsed.inn_name,
        suggested_name: parsed.brand_name_corrected || undefined,
        dosage_form: parsed.dosage_form,
        schedule_class: parsed.schedule_class,
        is_nti: parsed.is_nti || false,
      };
    } catch (e: any) {
      console.error('[DemandLog] Claude validation failed:', e.message);
      return { status: 'pending', source: 'claude_api', notes: 'Validation failed — review manually' };
    }
  }

  // ── Main: validate through all layers ────────────────────────────────
  async validate(name: string, tenantId: string): Promise<ValidationResult> {
    // Layer 1
    const dbMatch = await this.matchDB(name, tenantId);
    if (dbMatch) return dbMatch;

    // Layer 2
    const jaMatch = await this.matchJA(name, tenantId);
    if (jaMatch) return jaMatch;

    // Layer 3
    return this.validateViaClaude(name);
  }

  // ── Log demand entry ──────────────────────────────────────────────────
  async logDemand(
    dto: LogDemandDto,
    userId: string,
    tenantId: string,
  ) {
    // Run validation
    const validation = await this.validate(dto.medicine_name_raw, tenantId);

    const [entry] = await this.db.query(
      `INSERT INTO demand_log
         (medicine_name_raw, validation_status, validation_source,
          suggested_name, inn_name, dosage_form, schedule_class, is_nti,
          validation_notes, medicine_id,
          qty_requested, has_prescription, patient_mobile, patient_name,
          logged_by, tenant_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        dto.medicine_name_raw,
        validation.status,
        validation.source,
        validation.suggested_name || null,
        validation.inn_name || null,
        validation.dosage_form || null,
        validation.schedule_class || null,
        validation.is_nti || false,
        validation.notes || null,
        validation.medicine_id || null,
        dto.qty_requested || null,
        dto.has_prescription ?? null,
        dto.patient_mobile || null,
        dto.patient_name || null,
        userId,
        tenantId,
      ]
    );

    return { ...entry, validation };
  }

  // ── Weekly demand summary for owner dashboard ─────────────────────────
  async getSummary(tenantId: string, days = 7) {
    return this.db.query(
      `SELECT
         COALESCE(d.suggested_name, d.medicine_name_raw) AS medicine_name,
         d.inn_name,
         d.validation_status,
         d.schedule_class,
         d.is_nti,
         COUNT(*)::int                                    AS total_requests,
         SUM(CASE WHEN d.has_prescription THEN 1 ELSE 0 END)::int AS rx_requests,
         MAX(d.created_at)                               AS last_requested,
         MIN(d.status)                                   AS demand_status
       FROM demand_log d
       WHERE d.tenant_id = $1
         AND d.created_at >= NOW() - INTERVAL '1 day' * $2
         AND d.status = 'open'
       GROUP BY
         COALESCE(d.suggested_name, d.medicine_name_raw),
         d.inn_name, d.validation_status, d.schedule_class, d.is_nti
       ORDER BY total_requests DESC
       LIMIT 50`,
      [tenantId, days]
    );
  }

  // ── List raw demand log ───────────────────────────────────────────────
  async list(tenantId: string, status?: string) {
    return this.db.query(
      `SELECT d.*, u.full_name AS logged_by_name
       FROM demand_log d
       LEFT JOIN users u ON u.id = d.logged_by
       WHERE d.tenant_id = $1
         AND ($2::text IS NULL OR d.status = $2)
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [tenantId, status || null]
    );
  }

  // ── Mark as resolved (stocked / dismissed / added to PO) ─────────────
  async resolve(
    id: string,
    resolution: 'stocked' | 'dismissed' | 'added_to_po',
    userId: string,
    tenantId: string,
  ) {
    await this.db.query(
      `UPDATE demand_log
       SET status = $1, resolved_at = NOW(), resolved_by = $2
       WHERE id = $3 AND tenant_id = $4`,
      [resolution, userId, id, tenantId]
    );
    return { success: true };
  }
}
