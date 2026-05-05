import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class PatientHealthService {
  private claude: Anthropic;

  constructor(@InjectDataSource() private ds: DataSource) {
    this.claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async getTimeline(patientId: string, tenantId: string) {
    return this.ds
      .query(
        `SELECT * FROM patient_health_timeline
         WHERE patient_id = $1 AND tenant_id = $2
         ORDER BY event_at DESC LIMIT 50`,
        [patientId, tenantId],
      )
      .catch(() => []);
  }

  async getSummary(patientId: string, tenantId: string) {
    const [cached] = await this.ds
      .query(
        `SELECT * FROM patient_health_summary
         WHERE patient_id = $1 AND tenant_id = $2`,
        [patientId, tenantId],
      )
      .catch(() => []);

    const isStale =
      !cached ||
      new Date().getTime() - new Date(cached.computed_at).getTime() > 3600_000;

    if (isStale) {
      await this.recomputeSummary(patientId, tenantId);
      const [fresh] = await this.ds
        .query(
          `SELECT * FROM patient_health_summary
           WHERE patient_id = $1 AND tenant_id = $2`,
          [patientId, tenantId],
        )
        .catch(() => []);
      return fresh;
    }
    return cached;
  }

  async getVitalsChart(patientId: string, tenantId: string) {
    const rows = await this.ds
      .query(
        `SELECT
           recorded_at::DATE AS date,
           bp_systolic, bp_diastolic, pulse_rate,
           weight, bmi, spo2, blood_sugar, temperature
         FROM pre_checks
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE
         ORDER BY recorded_at DESC LIMIT 10`,
        [patientId, tenantId],
      )
      .catch(() => []);
    return rows.reverse();
  }

  // --------------------------------------------------------------------------
  // GET /patient-health/:patientId/brief
  // Full clinical context sent to Claude — LLM as clinical reasoner
  // --------------------------------------------------------------------------
  async getAiBrief(patientId: string, tenantId: string) {
    const summary = await this.getSummary(patientId, tenantId);

    // Return cached brief if generated within last 6 hours
    if (
      summary?.ai_brief &&
      summary?.ai_brief_generated_at &&
      new Date().getTime() - new Date(summary.ai_brief_generated_at).getTime() < 21600_000
    ) {
      return { brief: summary.ai_brief, from_cache: true };
    }

    // ── 1. Full vitals history (all readings, chronological) ─────────────────
    const allVitals = await this.ds
      .query(
        `SELECT
           recorded_at::DATE AS date,
           bp_systolic, bp_diastolic, pulse_rate,
           weight, bmi, spo2, blood_sugar, temperature,
           chief_complaint, allergies, current_medicines
         FROM pre_checks
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE
         ORDER BY recorded_at ASC`,
        [patientId, tenantId],
      )
      .catch(() => []);

    // ── 2. Full consultation history ─────────────────────────────────────────
    const allConsultations = await this.ds
      .query(
        `SELECT
           c.created_at::DATE AS date,
           c.diagnosis, c.symptoms, c.examination,
           c.advice, c.follow_up_date, c.referral,
           c.is_follow_up, c.diagnosis_code,
           u.full_name AS doctor_name,
           q.chief_complaint, q.visit_type
         FROM consultations c
         JOIN queues q ON q.id = c.queue_id
         LEFT JOIN users u ON u.id = c.doctor_id
         WHERE c.patient_id = $1 AND c.tenant_id = $2
           AND c.is_active = TRUE
         ORDER BY c.created_at ASC`,
        [patientId, tenantId],
      )
      .catch(() => []);

    // ── 3. Patient demographics ───────────────────────────────────────────────
    const [patient] = await this.ds
      .query(
        `SELECT first_name, last_name, mobile,
                date_of_birth, gender, allergies, chronic_conditions
         FROM patients
         WHERE id = $1 AND tenant_id = $2`,
        [patientId, tenantId],
      )
      .catch(() => [{}]);

    const p = patient || {};
    const age = p.date_of_birth
      ? Math.floor((new Date().getTime() - new Date(p.date_of_birth).getTime()) / (365.25 * 86400_000))
      : null;

    // ── 4. Build structured clinical context ─────────────────────────────────

    // Vitals timeline — compact format
    const vitalsHistory = allVitals.length > 0
      ? allVitals.map((v: any) =>
          `  ${v.date}: BP ${v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}mmHg` : '—'} | ` +
          `Pulse ${v.pulse_rate || '—'}bpm | ` +
          `Wt ${v.weight ? `${v.weight}kg` : '—'} | ` +
          `Sugar ${v.blood_sugar ? `${v.blood_sugar}mg/dL` : '—'} | ` +
          `SpO2 ${v.spo2 ? `${v.spo2}%` : '—'} | ` +
          `Temp ${v.temperature ? `${v.temperature}°F` : '—'}` +
          (v.chief_complaint ? ` | Complaint: ${v.chief_complaint}` : '') +
          (v.current_medicines ? ` | Self-reported meds: ${v.current_medicines}` : '')
        ).join('\n')
      : '  No vitals on record';

    // Compute vitals trends explicitly for Claude
    const vitalsAnalysis = (() => {
      if (allVitals.length < 2) return 'Insufficient data for trend analysis.';
      const lines: string[] = [];

      // BP trend
      const bpReadings = allVitals.filter((v: any) => v.bp_systolic).map((v: any) => v.bp_systolic);
      if (bpReadings.length >= 2) {
        const first = bpReadings[0], last = bpReadings[bpReadings.length - 1];
        const diff = last - first;
        const max = Math.max(...bpReadings);
        lines.push(`BP systolic: ${first} → ${last} mmHg (${diff > 0 ? '+' : ''}${diff} over ${bpReadings.length} readings, peak ${max})`);
      }

      // Weight trend
      const wtReadings = allVitals.filter((v: any) => v.weight).map((v: any) => parseFloat(v.weight));
      if (wtReadings.length >= 2) {
        const diff = (wtReadings[wtReadings.length - 1] - wtReadings[0]).toFixed(1);
        lines.push(`Weight: ${wtReadings[0]}kg → ${wtReadings[wtReadings.length - 1]}kg (${parseFloat(diff) > 0 ? '+' : ''}${diff}kg)`);
      }

      // Sugar trend
      const sugarReadings = allVitals.filter((v: any) => v.blood_sugar).map((v: any) => parseFloat(v.blood_sugar));
      if (sugarReadings.length >= 2) {
        const diff = (sugarReadings[sugarReadings.length - 1] - sugarReadings[0]).toFixed(0);
        lines.push(`Blood sugar: ${sugarReadings[0]} → ${sugarReadings[sugarReadings.length - 1]} mg/dL (${parseFloat(diff) > 0 ? '+' : ''}${diff})`);
      }

      return lines.length > 0 ? lines.join('\n') : 'No significant trend data.';
    })();

    // Consultation history — full detail
    const consultHistory = allConsultations.length > 0
      ? allConsultations.map((c: any, i: number) =>
          `  Visit ${i + 1} (${c.date})${c.is_follow_up ? ' [Follow-up]' : ''}:\n` +
          `    Chief complaint: ${c.chief_complaint || 'N/A'}\n` +
          `    Diagnosis: ${c.diagnosis || 'N/A'}${c.diagnosis_code ? ` (${c.diagnosis_code})` : ''}\n` +
          (c.symptoms ? `    Symptoms: ${c.symptoms}\n` : '') +
          (c.examination ? `    Examination: ${c.examination}\n` : '') +
          (c.advice ? `    Advice: ${c.advice}\n` : '') +
          (c.follow_up_date ? `    Follow-up requested: ${c.follow_up_date}\n` : '') +
          (c.referral ? `    Referral: ${c.referral}\n` : '')
        ).join('\n')
      : '  No consultations on record';

    // Recurring diagnoses — pattern detection
    const diagnosisCounts: Record<string, number> = {};
    allConsultations.forEach((c: any) => {
      if (c.diagnosis) {
        const d = c.diagnosis.trim();
        diagnosisCounts[d] = (diagnosisCounts[d] || 0) + 1;
      }
    });
    const recurringDiagnoses = Object.entries(diagnosisCounts)
      .filter(([, count]) => count > 1)
      .sort(([, a], [, b]) => b - a)
      .map(([d, count]) => `${d} (×${count})`)
      .join(', ');

    // Visit gap analysis
    const visitDates = allConsultations.map((c: any) => new Date(c.date).getTime()).sort();
    const gaps = visitDates.slice(1).map((d, i) =>
      Math.round((d - visitDates[i]) / 86400_000)
    );
    const avgGap = gaps.length > 0
      ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
      : null;
    const daysSinceLastVisit = visitDates.length > 0
      ? Math.round((new Date().getTime() - visitDates[visitDates.length - 1]) / 86400_000)
      : null;

    // ── 5. Build the deep clinical prompt ────────────────────────────────────
    const prompt = `You are an experienced clinical assistant at MediSyn Speciality Clinic, Taliparamba, Kerala, India.

A patient is about to enter the doctor's consultation room. Your job is to analyse their complete medical history and give the doctor a precise, actionable pre-consultation brief — like a senior nurse handing over the case.

Think like a clinician: look for patterns, trends, red flags, unresolved issues, and what needs attention TODAY. Do not just summarise — reason across the data.

══════════════════════════════════════════════
PATIENT PROFILE
══════════════════════════════════════════════
${age ? `Age: ${age} years` : 'Age: Unknown'}
${p.gender ? `Gender: ${p.gender}` : ''}
${p.allergies ? `Known allergies: ${p.allergies}` : 'Allergies: None recorded'}
${p.chronic_conditions ? `Chronic conditions: ${p.chronic_conditions}` : ''}
Total visits: ${summary?.total_visits || allConsultations.length}
Days since last visit: ${daysSinceLastVisit ?? 'Unknown'}
Average gap between visits: ${avgGap ? `${avgGap} days` : 'N/A'}

══════════════════════════════════════════════
VITALS HISTORY (chronological)
══════════════════════════════════════════════
${vitalsHistory}

COMPUTED TRENDS:
${vitalsAnalysis}

══════════════════════════════════════════════
CONSULTATION HISTORY (chronological)
══════════════════════════════════════════════
${consultHistory}

${recurringDiagnoses ? `RECURRING DIAGNOSES: ${recurringDiagnoses}` : ''}

══════════════════════════════════════════════
YOUR TASK
══════════════════════════════════════════════
Write a pre-consultation brief with these FOUR sections:

🔴 RED FLAGS (if any)
Immediate concerns the doctor must not miss — abnormal vitals trends, dangerous patterns, overdue critical follow-ups. Skip this section if none.

📊 HEALTH TRAJECTORY
In 2-3 sentences: how is this patient's health trending overall? Are things improving, stable, or deteriorating? Reference specific numbers.

🩺 WHAT TO CHECK TODAY
3-4 specific things the doctor should examine or ask about this visit, based on the history. Be specific — not generic advice.

💡 CLINICAL INSIGHT
One observation the doctor might not see from a quick glance — a pattern across visits, a correlation, an emerging risk, or a missed follow-up that needs attention.

Be direct, clinical, and specific. Use actual numbers from the data. Avoid generic advice.
Indian clinical context: patients in Kerala often present late, are on multiple medications, and may have undiagnosed diabetes/hypertension alongside acute complaints.`;

    // ── 6. Call Claude ────────────────────────────────────────────────────────
    const response = await this.claude.messages
      .create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        system: 'You are a senior clinical assistant. You reason across longitudinal patient data to give doctors precise, actionable pre-consultation briefs. You never give generic advice — every point must reference specific data from the patient record.',
        messages: [{ role: 'user', content: prompt }],
      })
      .catch((e: any) => {
        console.error('[ai-brief] Claude error:', e.message);
        return null;
      });

    const brief =
      response?.content?.[0]?.type === 'text'
        ? response.content[0].text
        : 'Unable to generate brief — check ANTHROPIC_API_KEY in Railway env vars.';

    // ── 7. Cache ──────────────────────────────────────────────────────────────
    await this.ds
      .query(
        `UPDATE patient_health_summary
         SET ai_brief = $1, ai_brief_generated_at = NOW(), updated_at = NOW()
         WHERE patient_id = $2 AND tenant_id = $3`,
        [brief, patientId, tenantId],
      )
      .catch(() => null);

    return { brief, from_cache: false };
  }

  async recomputeSummary(patientId: string, tenantId: string) {
    const [visitStats] = await this.ds
      .query(
        `SELECT
           COUNT(*)::INTEGER     AS total_visits,
           MIN(created_at::DATE) AS first_visit_date,
           MAX(created_at::DATE) AS last_visit_date,
           (SELECT doctor_id FROM queues
            WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE
            ORDER BY created_at DESC LIMIT 1) AS last_doctor_id
         FROM queues
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE`,
        [patientId, tenantId],
      )
      .catch(() => [{}]);

    const [latestVitals] = await this.ds
      .query(
        `SELECT bp_systolic, bp_diastolic, pulse_rate, temperature,
                weight, bmi, spo2, blood_sugar
         FROM pre_checks
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE
         ORDER BY recorded_at DESC LIMIT 1`,
        [patientId, tenantId],
      )
      .catch(() => [{}]);

    const lv = latestVitals || {};

    const twoVitals = await this.ds
      .query(
        `SELECT bp_systolic, weight, blood_sugar
         FROM pre_checks
         WHERE patient_id = $1 AND tenant_id = $2 AND is_active = TRUE
         ORDER BY recorded_at DESC LIMIT 2`,
        [patientId, tenantId],
      )
      .catch(() => []);

    const trend = (curr: number, prev: number) => {
      if (!curr || !prev) return 'stable';
      return curr - prev > 5 ? 'up' : curr - prev < -5 ? 'down' : 'stable';
    };

    const bp_trend     = twoVitals.length >= 2 ? trend(twoVitals[0].bp_systolic, twoVitals[1].bp_systolic) : 'stable';
    const weight_trend = twoVitals.length >= 2 ? trend(twoVitals[0].weight, twoVitals[1].weight) : 'stable';
    const sugar_trend  = twoVitals.length >= 2 ? trend(twoVitals[0].blood_sugar, twoVitals[1].blood_sugar) : 'stable';

    const daysSinceVisit = visitStats?.last_visit_date
      ? Math.floor((new Date().getTime() - new Date(visitStats.last_visit_date).getTime()) / 86400_000)
      : null;

    const [followUpCheck] = await this.ds
      .query(
        `SELECT follow_up_date FROM consultations
         WHERE patient_id = $1 AND tenant_id = $2
           AND follow_up_date IS NOT NULL
           AND follow_up_date < CURRENT_DATE
           AND is_active = TRUE
         ORDER BY follow_up_date DESC LIMIT 1`,
        [patientId, tenantId],
      )
      .catch(() => [null]);

    const flags = {
      flag_missed_refill:       daysSinceVisit !== null && daysSinceVisit > 45,
      flag_polypharmacy:        false,
      flag_bp_elevated:         !!(lv.bp_systolic > 140 || lv.bp_diastolic > 90),
      flag_sugar_elevated:      !!(lv.blood_sugar > 200),
      flag_overdue_followup:    !!followUpCheck,
      flag_frequent_visitor:    false,
      flag_multiple_analgesics: false,
    };

    await this.ds
      .query(
        `INSERT INTO patient_health_summary (
           id, tenant_id, patient_id,
           total_visits, first_visit_date, last_visit_date, last_doctor_id,
           latest_bp_systolic, latest_bp_diastolic, latest_pulse,
           latest_weight, latest_bmi, latest_spo2, latest_blood_sugar, latest_temperature,
           bp_trend, weight_trend, sugar_trend,
           active_medicine_count, unique_molecules,
           last_dispensing_date, days_since_refill,
           flag_missed_refill, flag_polypharmacy, flag_bp_elevated,
           flag_sugar_elevated, flag_overdue_followup,
           flag_frequent_visitor, flag_multiple_analgesics,
           risk_score, computed_at
         ) VALUES (
           gen_random_uuid(), $1, $2,
           $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13, $14,
           $15, $16, $17,
           $18, $19, $20, $21,
           $22, $23, $24, $25, $26, $27, $28,
           0, NOW()
         )
         ON CONFLICT (patient_id, tenant_id) DO UPDATE SET
           total_visits          = EXCLUDED.total_visits,
           first_visit_date      = EXCLUDED.first_visit_date,
           last_visit_date       = EXCLUDED.last_visit_date,
           last_doctor_id        = EXCLUDED.last_doctor_id,
           latest_bp_systolic    = EXCLUDED.latest_bp_systolic,
           latest_bp_diastolic   = EXCLUDED.latest_bp_diastolic,
           latest_pulse          = EXCLUDED.latest_pulse,
           latest_weight         = EXCLUDED.latest_weight,
           latest_bmi            = EXCLUDED.latest_bmi,
           latest_spo2           = EXCLUDED.latest_spo2,
           latest_blood_sugar    = EXCLUDED.latest_blood_sugar,
           latest_temperature    = EXCLUDED.latest_temperature,
           bp_trend              = EXCLUDED.bp_trend,
           weight_trend          = EXCLUDED.weight_trend,
           sugar_trend           = EXCLUDED.sugar_trend,
           active_medicine_count = EXCLUDED.active_medicine_count,
           unique_molecules      = EXCLUDED.unique_molecules,
           last_dispensing_date  = EXCLUDED.last_dispensing_date,
           days_since_refill     = EXCLUDED.days_since_refill,
           flag_missed_refill        = EXCLUDED.flag_missed_refill,
           flag_polypharmacy         = EXCLUDED.flag_polypharmacy,
           flag_bp_elevated          = EXCLUDED.flag_bp_elevated,
           flag_sugar_elevated       = EXCLUDED.flag_sugar_elevated,
           flag_overdue_followup     = EXCLUDED.flag_overdue_followup,
           flag_frequent_visitor     = EXCLUDED.flag_frequent_visitor,
           flag_multiple_analgesics  = EXCLUDED.flag_multiple_analgesics,
           computed_at           = NOW(),
           updated_at            = NOW()`,
        [
          tenantId, patientId,
          visitStats?.total_visits || 0,
          visitStats?.first_visit_date || null,
          visitStats?.last_visit_date || null,
          visitStats?.last_doctor_id || null,
          lv.bp_systolic    || null,
          lv.bp_diastolic   || null,
          lv.pulse_rate     || null,
          lv.weight         || null,
          lv.bmi            || null,
          lv.spo2           || null,
          lv.blood_sugar    || null,
          lv.temperature    || null,
          bp_trend, weight_trend, sugar_trend,
          0, [],
          visitStats?.last_visit_date || null,
          daysSinceVisit,
          flags.flag_missed_refill,
          flags.flag_polypharmacy,
          flags.flag_bp_elevated,
          flags.flag_sugar_elevated,
          flags.flag_overdue_followup,
          flags.flag_frequent_visitor,
          flags.flag_multiple_analgesics,
        ],
      )
      .catch((e: any) => console.error('[phs] upsert error:', e.message));

    await this.ds
      .query(
        `UPDATE patient_health_summary
         SET risk_score = compute_patient_risk_score($1, $2)
         WHERE patient_id = $1 AND tenant_id = $2`,
        [patientId, tenantId],
      )
      .catch(() => null);

    return { success: true };
  }
}
