// daily-alert.service.ts
// Place at: apps/api/src/ai-care/daily-alert.service.ts
//
// Sends daily morning WhatsApp alert to pharmacy owner/pharmacist with:
// - Expiry alerts (medicines expiring this week)
// - Low stock alerts
// - Pending bills / today's summary
// - Data deletion requests pending
//
// Runs at 8:00 AM IST (2:30 AM UTC) every day

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class DailyAlertService {
  private readonly logger = new Logger(DailyAlertService.name);

  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── 8:00 AM IST = 2:30 AM UTC ─────────────────────────────────────────────
  @Cron('30 2 * * *', { timeZone: 'Asia/Kolkata' })
  async sendDailyAlerts() {
    this.logger.log('Running daily WhatsApp alerts...');

    try {
      // Get all active tenants
      const tenants = await this.ds.query(
        `SELECT id, name FROM tenants WHERE is_active = true`
      );

      for (const tenant of tenants) {
        await this.sendAlertForTenant(tenant.id, tenant.name);
      }
    } catch (err: any) {
      this.logger.error(`Daily alert failed: ${err.message}`);
    }
  }

  async sendAlertForTenant(tenantId: string, clinicName: string) {
    try {
      // Get owner/pharmacist mobile numbers
      const staff = await this.ds.query(
        `SELECT mobile, full_name, role FROM users
         WHERE tenant_id = $1
         AND role IN ('owner', 'pharmacist')
         AND is_active = true
         AND mobile IS NOT NULL
         AND mobile != ''`,
        [tenantId]
      );

      if (!staff.length) return;

      // ── Gather alert data ─────────────────────────────────────────────────

      // 1. Expiring this week (7 days)
      const expiring = await this.ds.query(
        `SELECT m.brand_name, sb.expiry_date::text, SUM(sb.quantity)::int as qty
         FROM stock_batches sb
         JOIN medicines m ON m.id = sb.medicine_id
         WHERE sb.tenant_id = $1
           AND sb.is_active = true
           AND sb.quantity > 0
           AND sb.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
         GROUP BY m.brand_name, sb.expiry_date
         ORDER BY sb.expiry_date ASC
         LIMIT 5`,
        [tenantId]
      );

      // 2. Out of stock (zero stock, chronic medicines first)
      const outOfStock = await this.ds.query(
        `SELECT m.brand_name, m.is_chronic
         FROM medicines m
         WHERE m.tenant_id = $1 AND m.is_active = true
           AND NOT EXISTS (
             SELECT 1 FROM stock_batches sb
             WHERE sb.medicine_id = m.id
               AND sb.quantity > 0
               AND sb.expiry_date > CURRENT_DATE
               AND sb.is_active = true
           )
           AND m.reorder_qty > 0
         ORDER BY m.is_chronic DESC, m.brand_name ASC
         LIMIT 5`,
        [tenantId]
      );

      // 3. Low stock (below reorder level)
      const lowStock = await this.ds.query(
        `SELECT m.brand_name,
                COALESCE(SUM(sb.quantity),0)::int as stock,
                m.reorder_qty
         FROM medicines m
         LEFT JOIN stock_batches sb ON sb.medicine_id = m.id
           AND sb.is_active = true AND sb.quantity > 0
           AND sb.expiry_date > CURRENT_DATE
         WHERE m.tenant_id = $1 AND m.is_active = true
           AND m.reorder_qty > 0
         GROUP BY m.id, m.brand_name, m.reorder_qty
         HAVING COALESCE(SUM(sb.quantity),0) > 0
            AND COALESCE(SUM(sb.quantity),0) < m.reorder_qty
         ORDER BY (COALESCE(SUM(sb.quantity),0)::float / m.reorder_qty) ASC
         LIMIT 5`,
        [tenantId]
      );

      // 4. Today's sales summary
      const todaySales = await this.ds.query(
        `SELECT COUNT(*)::int as bill_count,
                COALESCE(SUM(total_amount),0)::numeric(10,2) as total
         FROM sales
         WHERE tenant_id = $1
           AND is_voided = false
           AND created_at::date = CURRENT_DATE`,
        [tenantId]
      );

      // 5. Pending data deletion requests
      const deletionRequests = await this.ds.query(
        `SELECT COUNT(*)::int as cnt FROM patients
         WHERE tenant_id = $1
           AND data_deletion_requested_at IS NOT NULL
           AND is_active = true`,
        [tenantId]
      );

      // 6. Refill due today
      const refillsDue = await this.ds.query(
        `SELECT COUNT(*)::int as cnt FROM medication_plans
         WHERE tenant_id = $1
           AND status = 'active'
           AND refill_reminder_date <= CURRENT_DATE`,
        [tenantId]
      );

      // ── Build message ─────────────────────────────────────────────────────
      const today = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      let msg = `🏥 *${clinicName}*\n📅 Good morning! Daily summary for ${today}\n\n`;

      // Yesterday's sales
      const bills = todaySales[0]?.bill_count || 0;
      const revenue = todaySales[0]?.total || 0;
      if (bills > 0) {
        msg += `💰 *Today so far:* ${bills} bill(s) · ₹${Number(revenue).toFixed(0)}\n\n`;
      }

      // Expiry alerts
      if (expiring.length > 0) {
        msg += `⚠️ *Expiring this week (${expiring.length}):*\n`;
        expiring.forEach((e: any) => {
          const d = new Date(e.expiry_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
          msg += `• ${e.brand_name} — expires ${d} (${e.qty} units)\n`;
        });
        msg += '\n';
      }

      // Out of stock
      if (outOfStock.length > 0) {
        msg += `🔴 *Out of stock (${outOfStock.length}):*\n`;
        outOfStock.forEach((m: any) => {
          msg += `• ${m.brand_name}${m.is_chronic ? ' 🔁' : ''}\n`;
        });
        msg += '\n';
      }

      // Low stock
      if (lowStock.length > 0) {
        msg += `🟡 *Low stock (${lowStock.length}):*\n`;
        lowStock.forEach((m: any) => {
          msg += `• ${m.brand_name} — ${m.stock} left (reorder at ${m.reorder_qty})\n`;
        });
        msg += '\n';
      }

      // Refills due
      if (refillsDue[0]?.cnt > 0) {
        msg += `💊 *Refill reminders due:* ${refillsDue[0].cnt} patient(s)\n`;
        msg += `   → Check AI Care Engine call list\n\n`;
      }

      // Data deletion
      if (deletionRequests[0]?.cnt > 0) {
        msg += `⚠️ *DPDPA:* ${deletionRequests[0].cnt} data deletion request(s) pending action\n\n`;
      }

      if (expiring.length === 0 && outOfStock.length === 0 && lowStock.length === 0) {
        msg += `✅ *All clear!* No urgent alerts today.\n\n`;
      }

      msg += `_Reply STOP to unsubscribe from daily alerts_`;

      // Send to owner first, then pharmacist
      const owner = staff.find((s: any) => s.role === 'owner') || staff[0];
      await this.sendWhatsApp(owner.mobile, msg, tenantId);

      this.logger.log(`Daily alert sent to ${owner.full_name} (${owner.mobile})`);
    } catch (err: any) {
      this.logger.warn(`Alert failed for tenant ${tenantId}: ${err.message}`);
    }
  }

  // ── Manual trigger endpoint (for testing) ─────────────────────────────────
  async triggerManual(tenantId: string): Promise<any> {
    const tenant = await this.ds.query(
      `SELECT id, name FROM tenants WHERE id = $1`, [tenantId]
    );
    if (!tenant.length) return { error: 'Tenant not found' };
    await this.sendAlertForTenant(tenantId, tenant[0].name);
    return { message: 'Daily alert sent', tenant: tenant[0].name };
  }

  private async sendWhatsApp(mobile: string, message: string, tenantId: string) {
    const token   = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || !phoneId) {
      this.logger.warn('WhatsApp not configured — WHATSAPP_TOKEN or WHATSAPP_PHONE_ID missing');
      // Log the message so you can see it even without WhatsApp
      this.logger.log(`[DAILY ALERT PREVIEW]\n${message}`);
      return;
    }

    const phone = mobile.replace(/\D/g, '');
    if (!phone || phone.length < 10) return;

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
            to: phone.startsWith('91') ? phone : `91${phone}`,
            type: 'text',
            text: { body: message },
          }),
        }
      );
      const data = await res.json() as any;
      if (data?.error) {
        this.logger.warn(`WhatsApp error: ${JSON.stringify(data.error)}`);
      }
    } catch (err: any) {
      this.logger.warn(`WhatsApp send failed: ${err.message}`);
    }
  }
}
