import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import * as dayjs from 'dayjs';

@Injectable()
export class LeaveNotificationService {
  constructor(@InjectDataSource() private dataSource: DataSource) {}

  // ── Create in-app notification ─────────────────────────────
  async createNotification(
    tenantId: string,
    userId: string,
    type: string,
    title: string,
    body: string,
    refId?: string,
  ) {
    await this.dataSource.query(
      `INSERT INTO notifications (tenant_id, user_id, type, title, body, ref_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, userId, type, title, body, refId ?? null],
    );
  }

  // ── Notify all owners when leave is applied ────────────────
  async notifyLeaveApplied(
    tenantId: string,
    staffName: string,
    staffRole: string,
    leaveType: string,
    fromDate: string,
    toDate: string,
    days: number,
    leaveId: string,
    reason?: string,
  ) {
    // Get all owner users for this tenant
    const owners = await this.dataSource.query(
      `SELECT id, full_name, email FROM users
       WHERE tenant_id = $1 AND role = 'owner' AND is_active = true`,
      [tenantId],
    );

    const title = `Leave request: ${staffName}`;
    const body  = `${staffRole} ${staffName} has applied for ${leaveType} leave from ${dayjs(fromDate).format('DD MMM')} to ${dayjs(toDate).format('DD MMM')} (${days} day${days > 1 ? 's' : ''}).${reason ? ` Reason: ${reason}` : ''}`;

    // In-app notification for each owner
    for (const owner of owners) {
      await this.createNotification(tenantId, owner.id, 'leave_request', title, body, leaveId);
    }

    // Get tenant notification settings
    const settings = await this.dataSource.query(
      `SELECT owner_email, owner_whatsapp, notify_email, notify_whatsapp
       FROM hr_settings WHERE tenant_id = $1`,
      [tenantId],
    );
    const cfg = settings[0];
    if (!cfg) return;

    // Email notification
    if (cfg.notify_email && cfg.owner_email) {
      await this.sendEmail(cfg.owner_email, title, body, leaveId);
    }

    // WhatsApp notification
    if (cfg.notify_whatsapp && cfg.owner_whatsapp) {
      await this.sendWhatsApp(cfg.owner_whatsapp, body);
    }
  }

  // ── Notify staff when leave is approved/rejected ───────────
  async notifyLeaveDecision(
    tenantId: string,
    staffUserId: string,
    staffName: string,
    leaveType: string,
    fromDate: string,
    toDate: string,
    action: 'approved' | 'rejected',
    approverName: string,
    note?: string,
    leaveId?: string,
  ) {
    const isApproved = action === 'approved';
    const title = `Leave ${isApproved ? 'approved' : 'rejected'}: ${leaveType}`;
    const body  = `Your ${leaveType} leave from ${dayjs(fromDate).format('DD MMM')} to ${dayjs(toDate).format('DD MMM')} has been ${action} by ${approverName}.${note ? ` Note: ${note}` : ''}`;

    await this.createNotification(
      tenantId, staffUserId,
      isApproved ? 'leave_approved' : 'leave_rejected',
      title, body, leaveId,
    );
  }

  // ── Get unread notification count ──────────────────────────
  async getUnreadCount(tenantId: string, userId: string): Promise<number> {
    const r = await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM notifications
       WHERE tenant_id = $1 AND user_id = $2 AND is_read = false`,
      [tenantId, userId],
    );
    return Number(r[0]?.cnt ?? 0);
  }

  // ── Get notifications ──────────────────────────────────────
  async getNotifications(tenantId: string, userId: string, limit = 20) {
    return this.dataSource.query(
      `SELECT * FROM notifications
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT $3`,
      [tenantId, userId, limit],
    );
  }

  // ── Mark as read ───────────────────────────────────────────
  async markRead(tenantId: string, userId: string, notifId?: string) {
    if (notifId) {
      await this.dataSource.query(
        `UPDATE notifications SET is_read = true
         WHERE id = $1 AND tenant_id = $2 AND user_id = $3`,
        [notifId, tenantId, userId],
      );
    } else {
      // Mark all read
      await this.dataSource.query(
        `UPDATE notifications SET is_read = true
         WHERE tenant_id = $1 AND user_id = $2 AND is_read = false`,
        [tenantId, userId],
      );
    }
  }

  // ── Email sender (via Resend or SMTP) ──────────────────────
  private async sendEmail(to: string, subject: string, body: string, leaveId: string) {
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) { console.log('[HR] No RESEND_API_KEY — email skipped'); return; }

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'MediSyn HR <hr@medisyn.in>',
          to:      [to],
          subject: `[MediSyn] ${subject}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
              <div style="background:#00475a;padding:20px;border-radius:8px 8px 0 0">
                <h2 style="color:white;margin:0">MediSyn HR</h2>
              </div>
              <div style="padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
                <h3 style="color:#1e293b">${subject}</h3>
                <p style="color:#475569;line-height:1.6">${body}</p>
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://medisynweb-production.up.railway.app'}/hr/leaves"
                   style="display:inline-block;margin-top:16px;padding:10px 20px;background:#00475a;color:white;border-radius:8px;text-decoration:none;font-weight:bold">
                  Review Leave Request →
                </a>
              </div>
            </div>
          `,
        }),
      });
      console.log(`[HR] Email sent to ${to}`);
    } catch (e) {
      console.error('[HR] Email failed:', e);
    }
  }

  // ── WhatsApp sender (via Meta Cloud API) ───────────────────
  private async sendWhatsApp(to: string, message: string) {
    try {
      const token   = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_ID;
      if (!token || !phoneId) { console.log('[HR] No WhatsApp config — skipped'); return; }

      // Clean phone number
      const phone = to.replace(/\D/g, '');

      await fetch(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: `🏥 MediSyn HR\n\n${message}\n\nOpen app: https://medisynweb-production.up.railway.app/hr/leaves` },
        }),
      });
      console.log(`[HR] WhatsApp sent to ${phone}`);
    } catch (e) {
      console.error('[HR] WhatsApp failed:', e);
    }
  }
}
