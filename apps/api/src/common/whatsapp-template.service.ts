import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export enum WaEvent {
  BILL_GENERATED     = 'bill_generated',
  PATIENT_REGISTERED = 'patient_registered',
  PRESCRIPTION_READY = 'prescription_ready',
  REFILL_REMINDER    = 'refill_reminder',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  LOW_STOCK_ALERT    = 'low_stock_alert',
  PAYMENT_RECEIVED   = 'payment_received',
}

// Default templates seeded for every new tenant
export const DEFAULT_TEMPLATES = [
  {
    event_type: WaEvent.BILL_GENERATED,
    template_name: 'Bill Generated - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','bill_number','amount','payment_mode','medicines_list'],
    message_body:
      `🏥 *{{clinic_name}}*

Dear {{patient_name}},

Your bill has been generated.

*Bill No:* {{bill_number}}
*Amount:* ₹{{amount}}
*Payment:* {{payment_mode}}

*Medicines:*
{{medicines_list}}

Thank you for visiting us. Get well soon! 🙏

_Reply STOP to opt out_`,
  },
  {
    event_type: WaEvent.BILL_GENERATED,
    template_name: 'Bill Generated - Owner Alert',
    send_to: 'owner',
    variables: ['bill_number','patient_name','amount','items_count'],
    message_body:
      `💊 *New Bill*

*Bill:* {{bill_number}}
*Patient:* {{patient_name}}
*Items:* {{items_count}}
*Amount:* ₹{{amount}}

_Billed just now_`,
  },
  {
    event_type: WaEvent.PATIENT_REGISTERED,
    template_name: 'Welcome Message - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','uhid','vip_plan'],
    message_body:
      `🎉 *Welcome to {{clinic_name}}!*

Dear {{patient_name}},

You have been successfully registered.

*Your ID:* {{uhid}}
*Plan:* {{vip_plan}}

✓ Priority service
✓ Health reminders via WhatsApp

Thank you for choosing us! 🙏`,
  },
  {
    event_type: WaEvent.PATIENT_REGISTERED,
    template_name: 'New Registration - Owner Alert',
    send_to: 'owner',
    variables: ['patient_name','uhid','mobile'],
    message_body:
      `👤 *New Patient Registered*

*Name:* {{patient_name}}
*UHID:* {{uhid}}
*Mobile:* {{mobile}}`,
  },
  {
    event_type: WaEvent.PRESCRIPTION_READY,
    template_name: 'Prescription Ready - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','doctor_name'],
    message_body:
      `✅ *{{clinic_name}}*

Dear {{patient_name}},

Your prescription from Dr. {{doctor_name}} is ready for pickup.

Please visit our pharmacy at your convenience.

Thank you! 🙏`,
  },
  {
    event_type: WaEvent.REFILL_REMINDER,
    template_name: 'Refill Reminder - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','medicine_name','days_remaining'],
    message_body:
      `🏥 *{{clinic_name}} — Refill Reminder*

Hello {{patient_name}},

Your medicine *{{medicine_name}}* is due for refill in {{days_remaining}} days.

Reply *YES* to reserve your refill.
Reply *STOP* to opt out.`,
  },
  {
    event_type: WaEvent.APPOINTMENT_CONFIRMED,
    template_name: 'Appointment Confirmed - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','doctor_name','appointment_date','appointment_time'],
    message_body:
      `📅 *Appointment Confirmed*

*Clinic:* {{clinic_name}}
*Patient:* {{patient_name}}
*Doctor:* {{doctor_name}}
*Date:* {{appointment_date}}
*Time:* {{appointment_time}}

Please arrive 10 minutes early. See you soon! 🙏`,
  },
  {
    event_type: WaEvent.LOW_STOCK_ALERT,
    template_name: 'Low Stock Alert - Owner',
    send_to: 'owner',
    variables: ['medicine_name','current_stock','reorder_qty'],
    message_body:
      `⚠️ *Low Stock Alert*

*Medicine:* {{medicine_name}}
*Current Stock:* {{current_stock}} units
*Reorder Qty:* {{reorder_qty}} units

Please reorder soon.`,
  },
  {
    event_type: WaEvent.PAYMENT_RECEIVED,
    template_name: 'Payment Received - Owner',
    send_to: 'owner',
    variables: ['patient_name','amount','payment_mode','bill_number'],
    message_body:
      `💰 *Payment Received*

*Patient:* {{patient_name}}
*Amount:* ₹{{amount}}
*Mode:* {{payment_mode}}
*Bill:* {{bill_number}}`,
  },
];

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(private readonly ds: DataSource) {}

  // ── Seed default templates for a tenant ──────────────────────────────────
  async seedDefaultTemplates(tenantId: string): Promise<void> {
    for (const tmpl of DEFAULT_TEMPLATES) {
      await this.ds.query(
        `INSERT INTO whatsapp_templates
           (tenant_id, event_type, template_name, send_to, variables, message_body, is_active, language)
         VALUES ($1,$2,$3,$4,$5,$6,true,'en')
         ON CONFLICT (tenant_id, event_type, send_to) DO NOTHING`,
        [tenantId, tmpl.event_type, tmpl.template_name, tmpl.send_to,
         JSON.stringify(tmpl.variables), tmpl.message_body],
      );
    }
    this.logger.log(`Seeded ${DEFAULT_TEMPLATES.length} WhatsApp templates for tenant ${tenantId}`);
  }

  // ── Load a template and replace variables ────────────────────────────────
  async renderTemplate(
    tenantId: string,
    eventType: WaEvent,
    sendTo: 'patient' | 'owner',
    variables: Record<string, string>,
  ): Promise<string | null> {
    const rows = await this.ds.query(
      `SELECT message_body FROM whatsapp_templates
       WHERE tenant_id=$1 AND event_type=$2 AND send_to=$3 AND is_active=true
       LIMIT 1`,
      [tenantId, eventType, sendTo],
    );

    if (!rows.length) {
      // Auto-seed if tenant has no templates yet
      await this.seedDefaultTemplates(tenantId);
      const retry = await this.ds.query(
        `SELECT message_body FROM whatsapp_templates
         WHERE tenant_id=$1 AND event_type=$2 AND send_to=$3 AND is_active=true
         LIMIT 1`,
        [tenantId, eventType, sendTo],
      );
      if (!retry.length) return null;
      rows.push(retry[0]);
    }

    let body: string = rows[0].message_body;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }
    return body;
  }

  // ── Core WhatsApp sender ─────────────────────────────────────────────────
  async send(mobile: string, message: string): Promise<boolean> {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      this.logger.warn('WhatsApp not configured — WHATSAPP_TOKEN or WHATSAPP_PHONE_ID missing');
      this.logger.debug(`[WA PREVIEW] To: ${mobile}\n${message}`);
      return false;
    }

    const phone = mobile.replace(/\D/g, '');
    if (!phone || phone.length < 10) return false;
    const to = phone.startsWith('91') ? phone : `91${phone}`;

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
            to,
            type: 'text',
            text: { body: message },
          }),
        },
      );
      const data = await res.json() as any;
      if (data.error) {
        this.logger.warn(`WhatsApp send failed: ${data.error.message}`);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.warn(`WhatsApp send error: ${err.message}`);
      return false;
    }
  }

  // ── Convenience: render + send in one call ───────────────────────────────
  async notify(
    tenantId: string,
    mobile: string,
    eventType: WaEvent,
    sendTo: 'patient' | 'owner',
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const message = await this.renderTemplate(tenantId, eventType, sendTo, variables);
      if (!message) return;
      await this.send(mobile, message);
    } catch (err: any) {
      this.logger.warn(`WhatsApp notify failed [${eventType}]: ${err.message}`);
    }
  }

  // ── Get owner mobile for a tenant ────────────────────────────────────────
  async getOwnerMobile(tenantId: string): Promise<string | null> {
    const rows = await this.ds.query(
      `SELECT mobile FROM users WHERE tenant_id=$1 AND role='owner' AND is_active=true AND mobile IS NOT NULL LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.mobile || null;
  }

  // ── Get clinic name for a tenant ─────────────────────────────────────────
  async getClinicName(tenantId: string): Promise<string> {
    const rows = await this.ds.query(
      `SELECT name FROM tenants WHERE id=$1 LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.name || 'MediSyn Clinic';
  }

  // ── CRUD for template management ─────────────────────────────────────────
  async listTemplates(tenantId: string) {
    return this.ds.query(
      `SELECT id, event_type, template_name, send_to, variables, message_body, is_active, language, updated_at
       FROM whatsapp_templates WHERE tenant_id=$1 ORDER BY event_type, send_to`,
      [tenantId],
    );
  }

  async updateTemplate(tenantId: string, id: string, body: {
    message_body?: string; is_active?: boolean; template_name?: string;
  }) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (body.message_body !== undefined) { fields.push(`message_body=$${idx++}`); params.push(body.message_body); }
    if (body.is_active !== undefined)    { fields.push(`is_active=$${idx++}`);    params.push(body.is_active); }
    if (body.template_name !== undefined){ fields.push(`template_name=$${idx++}`); params.push(body.template_name); }
    if (!fields.length) return null;
    fields.push(`updated_at=NOW()`);
    params.push(id, tenantId);
    const rows = await this.ds.query(
      `UPDATE whatsapp_templates SET ${fields.join(',')}
       WHERE id=$${idx++} AND tenant_id=$${idx} RETURNING *`,
      params,
    );
    return rows[0] || null;
  }

  async resetTemplate(tenantId: string, eventType: string, sendTo: string) {
    const def = DEFAULT_TEMPLATES.find(t => t.event_type === eventType && t.send_to === sendTo);
    if (!def) return null;
    const rows = await this.ds.query(
      `UPDATE whatsapp_templates
       SET message_body=$1, template_name=$2, is_active=true, updated_at=NOW()
       WHERE tenant_id=$3 AND event_type=$4 AND send_to=$5
       RETURNING *`,
      [def.message_body, def.template_name, tenantId, eventType, sendTo],
    );
    return rows[0] || null;
  }

  async previewTemplate(tenantId: string, eventType: WaEvent, sendTo: 'patient' | 'owner') {
    const sampleVars: Record<WaEvent, Record<string, string>> = {
      [WaEvent.BILL_GENERATED]:      { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', bill_number:'BILL-20260524-0001', amount:'450', payment_mode:'CASH', medicines_list:'  • TAB AZTOR 10MG × 10
  • CAP BECOSULES × 30', items_count:'2' },
      [WaEvent.PATIENT_REGISTERED]:  { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', uhid:'MED-001234', vip_plan:'Individual', mobile:'9876543210' },
      [WaEvent.PRESCRIPTION_READY]:  { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', doctor_name:'Dr. Sharma' },
      [WaEvent.REFILL_REMINDER]:     { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', medicine_name:'TAB METFORMIN 500MG', days_remaining:'3' },
      [WaEvent.APPOINTMENT_CONFIRMED]:{ clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', doctor_name:'Dr. Sharma', appointment_date:'25 May 2026', appointment_time:'10:30 AM' },
      [WaEvent.LOW_STOCK_ALERT]:     { medicine_name:'TAB AZTOR 10MG', current_stock:'5', reorder_qty:'100' },
      [WaEvent.PAYMENT_RECEIVED]:    { patient_name:'Rejesh Kumar', amount:'450', payment_mode:'UPI', bill_number:'BILL-20260524-0001' },
    };
    return this.renderTemplate(tenantId, eventType, sendTo, sampleVars[eventType] || {});
  }
}
