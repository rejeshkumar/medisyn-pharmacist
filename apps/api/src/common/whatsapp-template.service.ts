import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

export enum WaEvent {
  BILL_GENERATED      = 'bill_generated',
  PATIENT_REGISTERED  = 'patient_registered',
  PRESCRIPTION_READY  = 'prescription_ready',
  REFILL_REMINDER     = 'refill_reminder',
  APPOINTMENT_CONFIRMED = 'appointment_confirmed',
  LOW_STOCK_ALERT     = 'low_stock_alert',
  PAYMENT_RECEIVED    = 'payment_received',
}

interface WaTemplate {
  event_type: string;
  template_name: string;
  send_to: string;
  variables: string[];
  message_body: string;
}

export const DEFAULT_TEMPLATES: WaTemplate[] = [
  {
    event_type: WaEvent.BILL_GENERATED,
    template_name: 'Bill Generated - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','bill_number','amount','payment_mode','medicines_list'],
    message_body: '🏥 *{{clinic_name}}*\n\nDear {{patient_name}},\n\nYour bill has been generated.\n\n*Bill No:* {{bill_number}}\n*Amount:* Rs.{{amount}}\n*Payment:* {{payment_mode}}\n\n*Medicines:*\n{{medicines_list}}\n\nThank you for visiting us. Get well soon!\n\n_Reply STOP to opt out_',
  },
  {
    event_type: WaEvent.BILL_GENERATED,
    template_name: 'Bill Generated - Owner Alert',
    send_to: 'owner',
    variables: ['bill_number','patient_name','amount','items_count'],
    message_body: 'New Bill\n\nBill: {{bill_number}}\nPatient: {{patient_name}}\nItems: {{items_count}}\nAmount: Rs.{{amount}}\n\nBilled just now',
  },
  {
    event_type: WaEvent.PATIENT_REGISTERED,
    template_name: 'Welcome Message - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','uhid','vip_plan'],
    message_body: 'Welcome to {{clinic_name}}!\n\nDear {{patient_name}},\n\nYou have been registered.\n\nYour ID: {{uhid}}\nPlan: {{vip_plan}}\n\nThank you for choosing us!',
  },
  {
    event_type: WaEvent.PATIENT_REGISTERED,
    template_name: 'New Registration - Owner Alert',
    send_to: 'owner',
    variables: ['patient_name','uhid','mobile'],
    message_body: 'New Patient Registered\n\nName: {{patient_name}}\nUHID: {{uhid}}\nMobile: {{mobile}}',
  },
  {
    event_type: WaEvent.PRESCRIPTION_READY,
    template_name: 'Prescription Ready - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','doctor_name'],
    message_body: '{{clinic_name}}\n\nDear {{patient_name}},\n\nYour prescription from Dr. {{doctor_name}} is ready for pickup.\n\nThank you!',
  },
  {
    event_type: WaEvent.REFILL_REMINDER,
    template_name: 'Refill Reminder - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','medicine_name','days_remaining'],
    message_body: '{{clinic_name}} Refill Reminder\n\nHello {{patient_name}},\n\nYour medicine {{medicine_name}} is due for refill in {{days_remaining}} days.\n\nReply YES to reserve your refill.\nReply STOP to opt out.',
  },
  {
    event_type: WaEvent.APPOINTMENT_CONFIRMED,
    template_name: 'Appointment Confirmed - Patient',
    send_to: 'patient',
    variables: ['clinic_name','patient_name','doctor_name','appointment_date','appointment_time'],
    message_body: 'Appointment Confirmed\n\nClinic: {{clinic_name}}\nPatient: {{patient_name}}\nDoctor: {{doctor_name}}\nDate: {{appointment_date}}\nTime: {{appointment_time}}\n\nPlease arrive 10 minutes early.',
  },
  {
    event_type: WaEvent.LOW_STOCK_ALERT,
    template_name: 'Low Stock Alert - Owner',
    send_to: 'owner',
    variables: ['medicine_name','current_stock','reorder_qty'],
    message_body: 'Low Stock Alert\n\nMedicine: {{medicine_name}}\nCurrent Stock: {{current_stock}} units\nReorder Qty: {{reorder_qty}} units\n\nPlease reorder soon.',
  },
  {
    event_type: WaEvent.PAYMENT_RECEIVED,
    template_name: 'Payment Received - Owner',
    send_to: 'owner',
    variables: ['patient_name','amount','payment_mode','bill_number'],
    message_body: 'Payment Received\n\nPatient: {{patient_name}}\nAmount: Rs.{{amount}}\nMode: {{payment_mode}}\nBill: {{bill_number}}',
  },
];

@Injectable()
export class WhatsAppTemplateService {
  private readonly logger = new Logger(WhatsAppTemplateService.name);

  constructor(private readonly ds: DataSource) {}

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

  async renderTemplate(
    tenantId: string,
    eventType: WaEvent,
    sendTo: string,
    variables: Record<string, string>,
  ): Promise<string | null> {
    let rows = await this.ds.query(
      `SELECT message_body FROM whatsapp_templates
       WHERE tenant_id=$1 AND event_type=$2 AND send_to=$3 AND is_active=true LIMIT 1`,
      [tenantId, eventType, sendTo],
    );
    if (!rows.length) {
      await this.seedDefaultTemplates(tenantId);
      rows = await this.ds.query(
        `SELECT message_body FROM whatsapp_templates
         WHERE tenant_id=$1 AND event_type=$2 AND send_to=$3 AND is_active=true LIMIT 1`,
        [tenantId, eventType, sendTo],
      );
      if (!rows.length) return null;
    }
    let body: string = rows[0].message_body;
    for (const [key, value] of Object.entries(variables)) {
      body = body.replace(new RegExp(`\{\{${key}\}\}`, 'g'), value || '');
    }
    return body;
  }

  async send(mobile: string, message: string): Promise<boolean> {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;
    if (!token || !phoneId) {
      this.logger.warn('WhatsApp not configured');
      this.logger.debug('[WA PREVIEW] ' + mobile + ': ' + message);
      return false;
    }
    const phone = mobile.replace(/\D/g, '');
    if (!phone || phone.length < 10) return false;
    const to = phone.startsWith('91') ? phone : '91' + phone;
    try {
      const res = await fetch(
        'https://graph.facebook.com/v19.0/' + phoneId + '/messages',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token,
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
        this.logger.warn('WhatsApp send failed: ' + data.error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.warn('WhatsApp send error: ' + err.message);
      return false;
    }
  }

  async notify(
    tenantId: string,
    mobile: string,
    eventType: WaEvent,
    sendTo: string,
    variables: Record<string, string>,
  ): Promise<void> {
    try {
      const message = await this.renderTemplate(tenantId, eventType, sendTo, variables);
      if (!message) return;
      await this.send(mobile, message);
    } catch (err: any) {
      this.logger.warn('WhatsApp notify failed [' + eventType + ']: ' + err.message);
    }
  }

  async getOwnerMobile(tenantId: string): Promise<string | null> {
    const rows = await this.ds.query(
      `SELECT mobile FROM users WHERE tenant_id=$1 AND role='owner' AND is_active=true AND mobile IS NOT NULL LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.mobile || null;
  }

  async getClinicName(tenantId: string): Promise<string> {
    const rows = await this.ds.query(
      `SELECT name FROM tenants WHERE id=$1 LIMIT 1`,
      [tenantId],
    );
    return rows[0]?.name || 'MediSyn Clinic';
  }

  async listTemplates(tenantId: string): Promise<any[]> {
    return this.ds.query(
      `SELECT id, event_type, template_name, send_to, variables, message_body, is_active, language, updated_at
       FROM whatsapp_templates WHERE tenant_id=$1 ORDER BY event_type, send_to`,
      [tenantId],
    );
  }

  async updateTemplate(tenantId: string, id: string, body: {
    message_body?: string; is_active?: boolean; template_name?: string;
  }): Promise<any> {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    if (body.message_body !== undefined) { fields.push('message_body=$' + idx); idx++; params.push(body.message_body); }
    if (body.is_active !== undefined)    { fields.push('is_active=$' + idx);    idx++; params.push(body.is_active); }
    if (body.template_name !== undefined){ fields.push('template_name=$' + idx); idx++; params.push(body.template_name); }
    if (!fields.length) return null;
    fields.push('updated_at=NOW()');
    params.push(id, tenantId);
    const rows = await this.ds.query(
      'UPDATE whatsapp_templates SET ' + fields.join(',') +
      ' WHERE id=$' + idx + ' AND tenant_id=$' + (idx + 1) + ' RETURNING *',
      params,
    );
    return rows[0] || null;
  }

  async resetTemplate(tenantId: string, eventType: string, sendTo: string): Promise<any> {
    const def = DEFAULT_TEMPLATES.find(t => t.event_type === eventType && t.send_to === sendTo);
    if (!def) return null;
    const rows = await this.ds.query(
      `UPDATE whatsapp_templates
       SET message_body=$1, template_name=$2, is_active=true, updated_at=NOW()
       WHERE tenant_id=$3 AND event_type=$4 AND send_to=$5 RETURNING *`,
      [def.message_body, def.template_name, tenantId, eventType, sendTo],
    );
    return rows[0] || null;
  }

  async previewTemplate(tenantId: string, eventType: WaEvent, sendTo: string): Promise<string | null> {
    const samples: Record<string, Record<string, string>> = {
      bill_generated:       { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', bill_number:'BILL-20260524-0001', amount:'450', payment_mode:'CASH', medicines_list:'TAB AZTOR 10MG x 10', items_count:'1' },
      patient_registered:   { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', uhid:'MED-001234', vip_plan:'Individual', mobile:'9876543210' },
      prescription_ready:   { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', doctor_name:'Dr. Sharma' },
      refill_reminder:      { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', medicine_name:'TAB METFORMIN 500MG', days_remaining:'3' },
      appointment_confirmed: { clinic_name:'MediSyn Clinic', patient_name:'Rejesh Kumar', doctor_name:'Dr. Sharma', appointment_date:'25 May 2026', appointment_time:'10:30 AM' },
      low_stock_alert:      { medicine_name:'TAB AZTOR 10MG', current_stock:'5', reorder_qty:'100' },
      payment_received:     { patient_name:'Rejesh Kumar', amount:'450', payment_mode:'UPI', bill_number:'BILL-20260524-0001' },
    };
    const vars = samples[eventType as string] || {};
    return this.renderTemplate(tenantId, eventType, sendTo, vars);
  }
}
