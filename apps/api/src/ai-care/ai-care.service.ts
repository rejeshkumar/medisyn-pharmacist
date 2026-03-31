import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as dayjs from 'dayjs';

// ── Frequency helpers ─────────────────────────────────────────
const FREQUENCY_MAP: Record<string, number> = {
  'OD': 1, 'BD': 2, 'TID': 3, 'QID': 4,
  'HS': 1, 'SOS': 1, 'once daily': 1,
  'twice daily': 2, 'thrice daily': 3,
  '1-0-1': 2, '1-1-1': 3, '1-0-0': 1, '0-0-1': 1,
  'once in 2 days': 0.5, 'once a week': 0.14,
};

function freqPerDay(freq: string): number {
  if (!freq) return 1;
  const lower = freq.toLowerCase().trim();
  for (const [key, val] of Object.entries(FREQUENCY_MAP)) {
    if (lower.includes(key.toLowerCase())) return val;
  }
  return 1;
}

@Injectable()
export class AiCareService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ══════════════════════════════════════════════════════════
  // MEDICATION PLANS
  // ══════════════════════════════════════════════════════════

  async createPlan(dto: any, userId: string, userName: string) {
    const fpd = freqPerDay(dto.frequency);
    const totalQty = Math.ceil(
      (dto.total_quantity || fpd * (dto.duration_days || 30))
    );

    const r = await this.ds.query(
      `INSERT INTO medication_plans (
         tenant_id, patient_id, patient_name, patient_mobile,
         medicine_id, medicine_name, sale_id, prescription_id,
         dosage, frequency, frequency_per_day, notes,
         start_date, duration_days, total_quantity, refill_days_before,
         created_by, created_by_name
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       RETURNING *`,
      [
        dto.tenant_id, dto.patient_id||null, dto.patient_name||null, dto.patient_mobile||null,
        dto.medicine_id||null, dto.medicine_name,
        dto.sale_id||null, dto.prescription_id||null,
        dto.dosage||null, dto.frequency||null, fpd, dto.notes||null,
        dto.start_date||dayjs().format('YYYY-MM-DD'),
        dto.duration_days||30, totalQty, dto.refill_days_before||3,
        userId, userName,
      ],
    );
    return r[0];
  }

  async getPlans(tenantId: string, filters: any = {}) {
    const params: any[] = [tenantId];
    const where: string[] = [];
    if (filters.patient_id) { params.push(filters.patient_id); where.push(`mp.patient_id = $${params.length}`); }
    if (filters.status)     { params.push(filters.status);     where.push(`mp.status = $${params.length}`); }

    return this.ds.query(
      `SELECT mp.*, m.schedule_class, m.manufacturer,
              p.mobile AS patient_mobile_db
       FROM medication_plans mp
       LEFT JOIN medicines m ON m.id = mp.medicine_id
       LEFT JOIN patients  p ON p.id = mp.patient_id
       WHERE mp.tenant_id = $1
         ${where.length ? 'AND ' + where.join(' AND ') : ''}
       ORDER BY mp.created_at DESC
       LIMIT 200`,
      params,
    );
  }

  async updatePlanStatus(id: string, status: string, tenantId: string) {
    await this.ds.query(
      `UPDATE medication_plans SET status=$1, updated_at=NOW()
       WHERE id=$2 AND tenant_id=$3`,
      [status, id, tenantId],
    );
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // AI SCORING ENGINE
  // ══════════════════════════════════════════════════════════

  async computePriorityScore(patientId: string, tenantId: string, medicineId?: string) {
    let score = 50; // baseline
    const reasons: string[] = [];

    // Factor 1: Missed reminders (no response in last 7 days)
    const missedR = await this.ds.query(
      `SELECT COUNT(*) AS cnt FROM interaction_logs
       WHERE patient_id=$1 AND tenant_id=$2
         AND direction='outbound' AND response IS NULL
         AND created_at > NOW() - INTERVAL '7 days'`,
      [patientId, tenantId],
    );
    const missed = Number(missedR[0]?.cnt || 0);
    if (missed >= 3) { score += 30; reasons.push(`${missed} missed reminders`); }
    else if (missed >= 1) { score += 15; reasons.push(`${missed} missed reminder`); }

    // Factor 2: Chronic condition (has active plan > 30 days)
    const chronicR = await this.ds.query(
      `SELECT COUNT(*) AS cnt FROM medication_plans
       WHERE patient_id=$1 AND tenant_id=$2
         AND status='active' AND duration_days > 30`,
      [patientId, tenantId],
    );
    if (Number(chronicR[0]?.cnt) > 0) {
      score += 20;
      reasons.push('Chronic medication');
    }

    // Factor 3: Purchase history (no purchase in expected refill window)
    if (medicineId) {
      const lastPurchaseR = await this.ds.query(
        `SELECT MAX(s.created_at) AS last_date
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         WHERE si.medicine_id=$1 AND s.tenant_id=$2
           AND s.customer_name = (
             SELECT first_name||' '||COALESCE(last_name,'') FROM patients WHERE id=$3
           )`,
        [medicineId, tenantId, patientId],
      );
      const lastPurchase = lastPurchaseR[0]?.last_date;
      if (!lastPurchase) { score += 25; reasons.push('No purchase history'); }
    }

    // Factor 4: Response behavior
    const respondedR = await this.ds.query(
      `SELECT COUNT(*) AS cnt FROM interaction_logs
       WHERE patient_id=$1 AND tenant_id=$2
         AND direction='inbound' AND response='YES'
         AND created_at > NOW() - INTERVAL '30 days'`,
      [patientId, tenantId],
    );
    if (Number(respondedR[0]?.cnt) === 0) {
      score += 10;
      reasons.push('Never responded via WhatsApp');
    }

    // Cap score
    score = Math.min(100, score);
    const level: 'HIGH' | 'MEDIUM' | 'LOW' =
      score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';

    return { score, level, reasons };
  }

  // ══════════════════════════════════════════════════════════
  // REFILL FOLLOW-UPS
  // ══════════════════════════════════════════════════════════

  async runRefillPredictionJob(tenantId: string) {
    // Find plans where refill_reminder_date is today or past and still active
    const plans = await this.ds.query(
      `SELECT mp.*, p.mobile AS patient_mobile_resolved,
              p.first_name||' '||COALESCE(p.last_name,'') AS patient_name_resolved
       FROM medication_plans mp
       LEFT JOIN patients p ON p.id = mp.patient_id
       WHERE mp.tenant_id = $1
         AND mp.status = 'active'
         AND mp.refill_reminder_date <= CURRENT_DATE + INTERVAL '1 day'
         AND NOT EXISTS (
           SELECT 1 FROM refill_followups rf
           WHERE rf.medication_plan_id = mp.id
             AND rf.status NOT IN ('declined', 'no_response')
         )`,
      [tenantId],
    );

    let created = 0;
    for (const plan of plans) {
      // Check patient opt-in
      const prefs = await this.ds.query(
        `SELECT * FROM patient_preferences WHERE patient_id=$1`,
        [plan.patient_id],
      ).catch(() => []);
      if (prefs[0]?.reminder_enabled === false) continue;

      // Compute AI score
      const mobile = plan.patient_mobile || plan.patient_mobile_resolved;
      if (!mobile) continue;

      const { score, level, reasons } = await this.computePriorityScore(
        plan.patient_id, tenantId, plan.medicine_id,
      );

      await this.ds.query(
        `INSERT INTO refill_followups (
           tenant_id, patient_id, patient_name, patient_mobile,
           medication_plan_id, medicine_id, medicine_name,
           refill_due_date, priority_score, priority_level, priority_reasons, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending')
         ON CONFLICT DO NOTHING`,
        [
          tenantId, plan.patient_id,
          plan.patient_name || plan.patient_name_resolved,
          mobile, plan.id,
          plan.medicine_id, plan.medicine_name,
          plan.end_date, score, level,
          JSON.stringify(reasons),
        ],
      );
      created++;
    }
    return { created, checked: plans.length };
  }

  async getFollowups(tenantId: string, filters: any = {}) {
    const params: any[] = [tenantId];
    const where: string[] = [];
    if (filters.status)   { params.push(filters.status);   where.push(`rf.status = $${params.length}`); }
    if (filters.priority) { params.push(filters.priority); where.push(`rf.priority_level = $${params.length}`); }

    return this.ds.query(
      `SELECT rf.*,
              mp.dosage, mp.frequency, mp.end_date, mp.duration_days
       FROM refill_followups rf
       LEFT JOIN medication_plans mp ON mp.id = rf.medication_plan_id
       WHERE rf.tenant_id = $1
         ${where.length ? 'AND ' + where.join(' AND ') : ''}
       ORDER BY
         CASE rf.priority_level WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         rf.refill_due_date ASC
       LIMIT 200`,
      params,
    );
  }

  async updateFollowupStatus(id: string, status: string, notes: string, tenantId: string) {
    await this.ds.query(
      `UPDATE refill_followups
       SET status=$1, call_notes=COALESCE($2, call_notes),
           resolved_at=CASE WHEN $1 IN ('ordered','declined') THEN NOW() ELSE NULL END,
           updated_at=NOW()
       WHERE id=$3 AND tenant_id=$4`,
      [status, notes||null, id, tenantId],
    );
    return { ok: true };
  }

  // ══════════════════════════════════════════════════════════
  // WHATSAPP MESSAGING
  // ══════════════════════════════════════════════════════════

  async sendWhatsAppReminder(
    mobile: string, patientName: string, medicineName: string,
    type: 'medication' | 'refill', tenantId: string,
    patientId?: string, followupId?: string, planId?: string,
  ) {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      console.log('[AI Care] WhatsApp not configured');
      return null;
    }

    const phone = mobile.replace(/\D/g, '');
    let message = '';

    if (type === 'medication') {
      message = `🏥 MediSyn Health Reminder\n\nHello ${patientName},\n\nThis is a reminder to take your medicine:\n💊 ${medicineName}\n\nReply *YES* to confirm you've taken it, or *NO* if you haven't.\nReply *STOP* to opt out of reminders.`;
    } else {
      message = `🏥 MediSyn Refill Reminder\n\nHello ${patientName},\n\nYour medicine *${medicineName}* is due for refill soon.\n\nReply *YES* to place a refill order and we'll have it ready for you.\nReply *NO* if you don't need a refill.\nReply *STOP* to opt out.`;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${phoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: message },
          }),
        },
      );
      const data = await res.json() as any;
      const waId = data?.messages?.[0]?.id;

      // Log interaction
      await this.ds.query(
        `INSERT INTO interaction_logs (
           tenant_id, patient_id, patient_mobile, followup_id, medication_plan_id,
           message_type, direction, message_text, wa_message_id, delivery_status
         ) VALUES ($1,$2,$3,$4,$5,$6,'outbound',$7,$8,'sent')`,
        [
          tenantId, patientId||null, mobile, followupId||null, planId||null,
          type === 'medication' ? 'medication_reminder' : 'refill_reminder',
          message, waId||null,
        ],
      );

      // Update followup reminder count
      if (followupId) {
        await this.ds.query(
          `UPDATE refill_followups
           SET reminder_sent_at=NOW(), reminder_count=reminder_count+1,
               status='reminded', updated_at=NOW()
           WHERE id=$1`,
          [followupId],
        );
      }

      return { sent: true, wa_id: waId };
    } catch (e) {
      console.error('[AI Care] WhatsApp send failed:', e);
      return { sent: false, error: String(e) };
    }
  }

  // ── Handle inbound WhatsApp webhook response ──────────────
  async handleWhatsAppResponse(
    mobile: string, message: string, waMessageId: string,
  ) {
    const response = message.trim().toUpperCase();

    // Find patient by mobile
    const patients = await this.ds.query(
      `SELECT p.*, pp.tenant_id AS pref_tenant
       FROM patients p
       LEFT JOIN patient_preferences pp ON pp.patient_id = p.id
       WHERE p.mobile = $1 OR p.mobile = $2
       LIMIT 1`,
      [mobile, mobile.replace(/^91/, '0')],
    );
    const patient = patients[0];
    if (!patient) return { handled: false, reason: 'Patient not found' };

    const tenantId = patient.tenant_id || patient.pref_tenant;

    // Log inbound message
    await this.ds.query(
      `INSERT INTO interaction_logs (
         tenant_id, patient_id, patient_mobile,
         message_type, direction, message_text, response, wa_message_id
       ) VALUES ($1,$2,$3,'inbound','inbound',$4,$5,$6)`,
      [tenantId, patient.id, mobile, message, response, waMessageId],
    );

    if (response === 'STOP') {
      // Opt out
      await this.ds.query(
        `INSERT INTO patient_preferences (patient_id, tenant_id, reminder_enabled, whatsapp_opt_in, opted_out_at, opted_out_via)
         VALUES ($1,$2,false,false,NOW(),'whatsapp')
         ON CONFLICT (patient_id) DO UPDATE SET
           reminder_enabled=false, whatsapp_opt_in=false,
           opted_out_at=NOW(), opted_out_via='whatsapp'`,
        [patient.id, tenantId],
      );
      // Send confirmation
      await this.sendWhatsAppOptOutConfirmation(mobile, patient.first_name, tenantId, patient.id);
      return { handled: true, action: 'opted_out' };
    }

    // Find pending followup for this patient
    const followups = await this.ds.query(
      `SELECT * FROM refill_followups
       WHERE patient_id=$1 AND tenant_id=$2
         AND status IN ('pending','reminded')
       ORDER BY created_at DESC LIMIT 1`,
      [patient.id, tenantId],
    );
    const followup = followups[0];

    if (response === 'YES' && followup) {
      await this.ds.query(
        `UPDATE refill_followups SET status='ordered', last_response='YES',
         last_response_at=NOW(), resolved_at=NOW(), updated_at=NOW()
         WHERE id=$1`,
        [followup.id],
      );
      // Send confirmation message
      await this.sendRefillConfirmation(mobile, patient.first_name, followup.medicine_name, tenantId, patient.id);
      return { handled: true, action: 'order_created', followup_id: followup.id };
    }

    if (response === 'NO' && followup) {
      await this.ds.query(
        `UPDATE refill_followups SET status='declined', last_response='NO',
         last_response_at=NOW(), updated_at=NOW()
         WHERE id=$1`,
        [followup.id],
      );
      return { handled: true, action: 'declined', followup_id: followup.id };
    }

    return { handled: true, action: 'logged' };
  }

  private async sendRefillConfirmation(mobile: string, name: string, medicine: string, tenantId: string, patientId: string) {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) return;
    const msg = `✅ MediSyn\n\nThank you ${name}! Your refill order for *${medicine}* has been noted.\n\nOur pharmacist will keep it ready for you. See you soon! 🏥`;
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product:'whatsapp', to: mobile.replace(/\D/g,''), type:'text', text:{body:msg} }),
    });
    await this.ds.query(
      `INSERT INTO interaction_logs (tenant_id,patient_id,patient_mobile,message_type,direction,message_text)
       VALUES ($1,$2,$3,'confirmation','outbound',$4)`,
      [tenantId, patientId, mobile, msg],
    );
  }

  private async sendWhatsAppOptOutConfirmation(mobile: string, name: string, tenantId: string, patientId: string) {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) return;
    const msg = `MediSyn: You have been opted out of reminders, ${name}. You can re-enable reminders from the pharmacy or reply START.`;
    await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product:'whatsapp', to: mobile.replace(/\D/g,''), type:'text', text:{body:msg} }),
    });
  }

  // ══════════════════════════════════════════════════════════
  // SCHEDULER JOBS
  // ══════════════════════════════════════════════════════════

  async runDailyReminderJob(tenantId: string) {
    // Get all active plans where today matches dosing schedule
    const plans = await this.ds.query(
      `SELECT mp.*, p.mobile AS patient_mobile_resolved,
              p.first_name AS patient_first_name,
              pp.reminder_enabled, pp.whatsapp_opt_in
       FROM medication_plans mp
       LEFT JOIN patients p ON p.id = mp.patient_id
       LEFT JOIN patient_preferences pp ON pp.patient_id = mp.patient_id
       WHERE mp.tenant_id = $1
         AND mp.status = 'active'
         AND mp.start_date <= CURRENT_DATE
         AND mp.end_date >= CURRENT_DATE
         AND COALESCE(pp.reminder_enabled, true) = true
         AND COALESCE(pp.whatsapp_opt_in, true) = true`,
      [tenantId],
    );

    let sent = 0;
    for (const plan of plans) {
      const mobile = plan.patient_mobile || plan.patient_mobile_resolved;
      if (!mobile) continue;
      const name = plan.patient_name || plan.patient_first_name || 'Patient';
      await this.sendWhatsAppReminder(
        mobile, name, plan.medicine_name, 'medication',
        tenantId, plan.patient_id, null, plan.id,
      );
      sent++;
    }
    return { sent, total: plans.length };
  }

  async runEscalationJob(tenantId: string) {
    // Escalate followups with no response after 2 reminders
    const result = await this.ds.query(
      `UPDATE refill_followups
       SET status='escalated', priority_level='HIGH', updated_at=NOW()
       WHERE tenant_id=$1
         AND status='reminded'
         AND reminder_count >= 2
         AND last_response IS NULL
         AND updated_at < NOW() - INTERVAL '24 hours'
       RETURNING id, patient_name, medicine_name`,
      [tenantId],
    );
    return { escalated: result.length };
  }

  // ══════════════════════════════════════════════════════════
  // PATIENT PREFERENCES
  // ══════════════════════════════════════════════════════════

  async updatePreferences(patientId: string, tenantId: string, prefs: any) {
    await this.ds.query(
      `INSERT INTO patient_preferences (patient_id, tenant_id, reminder_enabled, whatsapp_opt_in, call_opt_in, preferred_lang)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (patient_id) DO UPDATE SET
         reminder_enabled = COALESCE($3, patient_preferences.reminder_enabled),
         whatsapp_opt_in  = COALESCE($4, patient_preferences.whatsapp_opt_in),
         call_opt_in      = COALESCE($5, patient_preferences.call_opt_in),
         preferred_lang   = COALESCE($6, patient_preferences.preferred_lang),
         updated_at       = NOW()`,
      [patientId, tenantId, prefs.reminder_enabled??null, prefs.whatsapp_opt_in??null, prefs.call_opt_in??null, prefs.preferred_lang||null],
    );
    return { ok: true };
  }

  // ── Dashboard stats ───────────────────────────────────────
  async getDashboardStats(tenantId: string) {
    const [plans, followups, interactions] = await Promise.all([
      this.ds.query(
        `SELECT status, COUNT(*)::int AS cnt FROM medication_plans WHERE tenant_id=$1 GROUP BY status`,
        [tenantId],
      ),
      this.ds.query(
        `SELECT status, priority_level, COUNT(*)::int AS cnt
         FROM refill_followups WHERE tenant_id=$1
         GROUP BY status, priority_level`,
        [tenantId],
      ),
      this.ds.query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE response='YES')::int AS yes_count,
                COUNT(*) FILTER (WHERE response='NO')::int  AS no_count,
                COUNT(*) FILTER (WHERE response='STOP')::int AS opt_outs
         FROM interaction_logs WHERE tenant_id=$1
           AND created_at > NOW() - INTERVAL '30 days'`,
        [tenantId],
      ),
    ]);
    return { plans, followups, interactions: interactions[0] };
  }
}
