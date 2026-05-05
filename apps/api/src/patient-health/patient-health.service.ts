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

  async getAiBrief(patientId: string, tenantId: string) {
    const summary = await this.getSummary(patientId, tenantId);
    const timeline = await this.getTimeline(patientId, tenantId);

    if (
      summary?.ai_brief &&
      summary?.ai_brief_generated_at &&
      new Date().getTime() - new Date(summary.ai_brief_generated_at).getTime() < 86400_000
    ) {
      return { brief: summary.ai_brief, from_cache: true };
    }

    const recentConsultations = timeline
      .filter((e: any) => e.event_type === 'consultation')
      .slice(0, 5)
      .map(
        (e: any) =>
          `${e.visit_date}: Diagnosis: ${e.diagnosis || 'N/A'}. ` +
          `Complaint: ${e.chief_complaint || 'N/A'}. ` +
          `BP: ${e.bp_systolic ? `${e.bp_systolic}/${e.bp_diastolic}` : 'N/A'}. ` +
          `Weight: ${e.weight ? `${e.weight}kg` : 'N/A'}. ` +
          `Sugar: ${e.blood_sugar ? `${e.blood_sugar} mg/dL` : 'N/A'}. ` +
          `Follow-up: ${e.follow_up_date || 'None'}.`,
      )
      .join('\n');

    const flags: string[] = [];
    if (summary?.flag_missed_refill)
      flags.push(`⚠️ No visit in ${summary.days_since_refill} days`);
    if (summary?.flag_bp_elevated)
      flags.push(`🔴 BP elevated: ${summary.latest_bp_systolic}/${summary.latest_bp_diastolic} mmHg`);
    if (summary?.flag_sugar_elevated)
      flags.push(`🔴 Blood sugar elevated: ${summary.latest_blood_sugar} mg/dL`);
    if (summary?.flag_overdue_followup)
      flags.push('⚠️ Follow-up appointment overdue');

    const prompt = `You are a clinical assistant at MediSyn Speciality Clinic, Kerala.
Prepare a concise pre-consultation brief for the doctor in 3-4 bullet points.
Be specific, clinical, and actionable. No fluff.

Patient Summary:
- Total visits: ${summary?.total_visits || 0}
- Last visit: ${summary?.last_visit_date || 'N/A'}
- Days since last visit: ${summary?.days_since_refill ?? 'N/A'}

Recent Consultations (newest first):
${recentConsultations || 'None on record'}

Risk Flags:
${flags.length ? flags.join('\n') : 'No active risk flags'}

Write exactly 3-4 bullet points the doctor should know BEFORE the consultation.
Focus on: vitals trends, adherence, unresolved issues, what to check today.
Keep each bullet under 20 words. Start each with •`;

    const response = await this.claude.messages
      .create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      })
      .catch(() => null);

    const brief =
      response?.content?.[0]?.type === 'text'
        ? response.content[0].text
        : 'Unable to generate brief at this time.';

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
