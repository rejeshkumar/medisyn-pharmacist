import {
  Controller, Get, Post, Patch, Body, Param,
  Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { AiCareService } from './ai-care.service';

@Controller('ai-care')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiCareController {
  constructor(private svc: AiCareService) {}

  // ── Dashboard stats ───────────────────────────────────────
  @Get('dashboard')
  dashboard(@Req() req: any) {
    return this.svc.getDashboardStats(req.user.tenant_id);
  }

  // ══════════════════════════════════════════════════════════
  // MEDICATION PLANS
  // ══════════════════════════════════════════════════════════

  @Post('medication-plans')
  createPlan(@Body() dto: any, @Req() req: any) {
    return this.svc.createPlan(
      { ...dto, tenant_id: req.user.tenant_id },
      req.user.sub,
      req.user.full_name,
    );
  }

  @Get('medication-plans')
  getPlans(@Query() q: any, @Req() req: any) {
    return this.svc.getPlans(req.user.tenant_id, q);
  }

  @Patch('medication-plans/:id/status')
  updatePlanStatus(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updatePlanStatus(id, body.status, req.user.tenant_id);
  }

  // ══════════════════════════════════════════════════════════
  // REFILL FOLLOW-UPS (Receptionist call list)
  // ══════════════════════════════════════════════════════════

  @Get('followups')
  getFollowups(@Query() q: any, @Req() req: any) {
    return this.svc.getFollowups(req.user.tenant_id, q);
  }

  @Patch('followups/:id/status')
  updateFollowup(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.svc.updateFollowupStatus(id, body.status, body.notes, req.user.tenant_id);
  }

  @Post('followups/:id/send-reminder')
  async sendReminder(@Param('id') id: string, @Req() req: any) {
    if (!['owner','receptionist'].includes(req.user.role)) throw new ForbiddenException();
    const [followup] = await this.svc.getFollowups(req.user.tenant_id, {});
    const f = (await this.svc.getFollowups(req.user.tenant_id, {})).find((x: any) => x.id === id);
    if (!f) return { error: 'Not found' };
    return this.svc.sendWhatsAppReminder(
      f.patient_mobile, f.patient_name, f.medicine_name,
      'refill', req.user.tenant_id, f.patient_id, f.id, f.medication_plan_id,
    );
  }

  // ══════════════════════════════════════════════════════════
  // SCHEDULER JOBS (can be called via cron or manually)
  // ══════════════════════════════════════════════════════════

  @Post('jobs/daily-reminders')
  runDailyReminders(@Req() req: any) {
    if (req.user.role !== 'owner') throw new ForbiddenException();
    return this.svc.runDailyReminderJob(req.user.tenant_id);
  }

  @Post('jobs/refill-prediction')
  runRefillPrediction(@Req() req: any) {
    if (req.user.role !== 'owner') throw new ForbiddenException();
    return this.svc.runRefillPredictionJob(req.user.tenant_id);
  }

  @Post('jobs/escalation')
  runEscalation(@Req() req: any) {
    if (req.user.role !== 'owner') throw new ForbiddenException();
    return this.svc.runEscalationJob(req.user.tenant_id);
  }

  // ══════════════════════════════════════════════════════════
  // AI SCORING
  // ══════════════════════════════════════════════════════════

  @Get('score/:patient_id')
  getScore(@Param('patient_id') patientId: string, @Query('medicine_id') medicineId: string, @Req() req: any) {
    return this.svc.computePriorityScore(patientId, req.user.tenant_id, medicineId);
  }

  // ══════════════════════════════════════════════════════════
  // PATIENT PREFERENCES
  // ══════════════════════════════════════════════════════════

  @Patch('preferences/:patient_id')
  updatePrefs(@Param('patient_id') patientId: string, @Body() body: any, @Req() req: any) {
    return this.svc.updatePreferences(patientId, req.user.tenant_id, body);
  }

  // ══════════════════════════════════════════════════════════
  // INTERACTION LOGS
  // ══════════════════════════════════════════════════════════

  @Get('interactions')
  getInteractions(@Query() q: any, @Req() req: any) {
    const limit = Number(q.limit) || 50;
    return this.svc['ds'].query(
      `SELECT il.*, p.first_name||' '||COALESCE(p.last_name,'') AS patient_name_db
       FROM interaction_logs il
       LEFT JOIN patients p ON p.id = il.patient_id
       WHERE il.tenant_id = $1
         ${q.patient_id ? `AND il.patient_id = '${q.patient_id}'` : ''}
       ORDER BY il.created_at DESC LIMIT $2`,
      [req.user.tenant_id, limit],
    );
  }
}

// ── WhatsApp webhook controller (no auth — public endpoint) ──
import { Controller as Ctrl, Post as P, Get as G, Body as B, Query as Q, Headers as H, Res } from '@nestjs/common';
import { Response } from 'express';

@Ctrl('whatsapp')
export class WhatsAppWebhookController {
  constructor(private svc: AiCareService) {}

  // Meta webhook verification
  @G('webhook')
  verifyWebhook(@Q('hub.mode') mode: string, @Q('hub.challenge') challenge: string, @Q('hub.verify_token') token: string, @Res() res: Response) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'medisyn_verify_2026';
    if (mode === 'subscribe' && token === verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Forbidden');
    }
  }

  // Inbound message handler
  @P('webhook')
  async receiveMessage(@B() body: any, @Res() res: Response) {
    try {
      const entry   = body?.entry?.[0];
      const changes = entry?.changes?.[0];
      const value   = changes?.value;
      const messages = value?.messages;

      if (messages?.length > 0) {
        const msg     = messages[0];
        const mobile  = msg.from;
        const text    = msg.text?.body || '';
        const waId    = msg.id;
        await this.svc.handleWhatsAppResponse(mobile, text, waId);
      }
    } catch (e) {
      console.error('[WhatsApp Webhook]', e);
    }
    res.status(200).json({ status: 'ok' });
  }
}
