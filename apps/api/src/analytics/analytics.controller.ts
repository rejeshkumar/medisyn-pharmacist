// analytics.controller.ts
// Place at: apps/api/src/analytics/analytics.controller.ts

import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface TrackEventDto {
  event_name:  string;
  event_type?: string;
  page?:       string;
  properties?: Record<string, any>;
  duration_ms?: number;
  session_id?: string;
}

@Controller('analytics')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AnalyticsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Track a single event ──────────────────────────────────────────────────
  @Post('track')
  async track(@Body() dto: TrackEventDto, @Req() req: any) {
    const user = req.user;
    const ua   = req.headers['user-agent'] || '';
    const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';

    // Fire and forget — never block the user action
    this.ds.query(
      `INSERT INTO analytics_events
         (tenant_id, user_id, user_name, user_role, session_id,
          event_type, event_name, page, properties, duration_ms, device_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        user.tenant_id,
        user.sub,
        user.name || user.full_name || '',
        user.role,
        dto.session_id || null,
        dto.event_type || 'action',
        dto.event_name,
        dto.page || null,
        JSON.stringify(dto.properties || {}),
        dto.duration_ms || null,
        device,
      ]
    ).catch(() => {}); // silently ignore errors

    return { ok: true };
  }

  // ── Track multiple events in batch ────────────────────────────────────────
  @Post('track-batch')
  async trackBatch(@Body() body: { events: TrackEventDto[] }, @Req() req: any) {
    const user   = req.user;
    const ua     = req.headers['user-agent'] || '';
    const device = /Mobile|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';

    for (const dto of (body.events || []).slice(0, 50)) {
      this.ds.query(
        `INSERT INTO analytics_events
           (tenant_id, user_id, user_name, user_role, session_id,
            event_type, event_name, page, properties, duration_ms, device_type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          user.tenant_id, user.sub,
          user.name || '', user.role,
          dto.session_id || null,
          dto.event_type || 'action',
          dto.event_name,
          dto.page || null,
          JSON.stringify(dto.properties || {}),
          dto.duration_ms || null,
          device,
        ]
      ).catch(() => {});
    }
    return { ok: true };
  }

  // ── Get behaviour summary (Owner only) ────────────────────────────────────
  @Get('summary')
  async getSummary(@Query('days') days: string, @Req() req: any) {
    if (req.user.role !== 'owner') return { error: 'Owner only' };
    const d = parseInt(days) || 7;
    const tenantId = req.user.tenant_id;

    const [
      topEvents, topPages, topUsers,
      dailyActivity, deviceSplit, avgDurations,
      errorEvents, searchStats
    ] = await Promise.all([

      // Top events by frequency
      this.ds.query(`
        SELECT event_name, COUNT(*)::int as count,
               ROUND(AVG(duration_ms))::int as avg_ms
        FROM analytics_events
        WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
        GROUP BY event_name ORDER BY count DESC LIMIT 10`,
        [tenantId, d]),

      // Top pages by visits
      this.ds.query(`
        SELECT page, COUNT(*)::int as views,
               COUNT(DISTINCT user_id)::int as unique_users
        FROM analytics_events
        WHERE tenant_id=$1 AND page IS NOT NULL
          AND created_at > NOW()-($2||' days')::interval
        GROUP BY page ORDER BY views DESC LIMIT 10`,
        [tenantId, d]),

      // Most active users
      this.ds.query(`
        SELECT user_name, user_role, COUNT(*)::int as actions,
               COUNT(DISTINCT DATE(created_at))::int as active_days
        FROM analytics_events
        WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
        GROUP BY user_name, user_role ORDER BY actions DESC LIMIT 10`,
        [tenantId, d]),

      // Daily activity
      this.ds.query(`
        SELECT DATE(created_at)::text as date,
               COUNT(*)::int as events,
               COUNT(DISTINCT user_id)::int as active_users
        FROM analytics_events
        WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
        GROUP BY DATE(created_at) ORDER BY date ASC`,
        [tenantId, d]),

      // Device split
      this.ds.query(`
        SELECT device_type, COUNT(*)::int as count
        FROM analytics_events
        WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
        GROUP BY device_type`,
        [tenantId, d]),

      // Slow actions (avg duration > 2s)
      this.ds.query(`
        SELECT event_name,
               ROUND(AVG(duration_ms))::int as avg_ms,
               ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms))::int as p95_ms,
               COUNT(*)::int as count
        FROM analytics_events
        WHERE tenant_id=$1 AND duration_ms IS NOT NULL
          AND created_at > NOW()-($2||' days')::interval
        GROUP BY event_name
        HAVING AVG(duration_ms) > 1000
        ORDER BY avg_ms DESC LIMIT 10`,
        [tenantId, d]),

      // Error events
      this.ds.query(`
        SELECT event_name, COUNT(*)::int as count,
               MAX(properties->>'error') as last_error
        FROM analytics_events
        WHERE tenant_id=$1 AND event_type='error'
          AND created_at > NOW()-($2||' days')::interval
        GROUP BY event_name ORDER BY count DESC LIMIT 10`,
        [tenantId, d]),

      // Medicine search stats
      this.ds.query(`
        SELECT
          COUNT(*)::int as total_searches,
          COUNT(CASE WHEN (properties->>'found')::boolean = true THEN 1 END)::int as found,
          COUNT(CASE WHEN (properties->>'found')::boolean = false THEN 1 END)::int as not_found,
          MODE() WITHIN GROUP (ORDER BY properties->>'query') as most_searched
        FROM analytics_events
        WHERE tenant_id=$1 AND event_name='medicine_searched'
          AND created_at > NOW()-($2||' days')::interval`,
        [tenantId, d]),
    ]);

    return {
      period_days:    d,
      top_events:     topEvents,
      top_pages:      topPages,
      top_users:      topUsers,
      daily_activity: dailyActivity,
      device_split:   deviceSplit,
      slow_actions:   avgDurations,
      errors:         errorEvents,
      search_stats:   searchStats[0] || {},
    };
  }

  // ── AI Insights (uses Claude to analyse behaviour) ─────────────────────────
  @Get('insights')
  async getInsights(@Req() req: any) {
    if (req.user.role !== 'owner') return { error: 'Owner only' };
    const tenantId = req.user.tenant_id;

    // Get last 7 days summary
    const summary = await this.getSummaryData(tenantId, 7);

    const prompt = `You are analysing user behaviour data for a pharmacy clinic management system called MediSyn.

Here is the usage data for the last 7 days:
${JSON.stringify(summary, null, 2)}

Provide 3-5 specific, actionable insights about:
1. How staff are using the system
2. Any workflow bottlenecks or slow features  
3. Features that are underused and why
4. Recommendations to improve efficiency
5. Any concerning patterns

Be specific and practical. Use the actual data provided. Keep each insight to 2-3 sentences.
Format as JSON: { "insights": [{ "title": "...", "detail": "...", "action": "..." }] }`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await res.json() as any;
      const text = data.content?.[0]?.text || '{}';
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch {
      return { insights: [] };
    }
  }

  private async getSummaryData(tenantId: string, days: number) {
    const [events, pages, users] = await Promise.all([
      this.ds.query(
        `SELECT event_name, COUNT(*)::int as count FROM analytics_events
         WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
         GROUP BY event_name ORDER BY count DESC LIMIT 15`,
        [tenantId, days]
      ),
      this.ds.query(
        `SELECT page, COUNT(*)::int as views FROM analytics_events
         WHERE tenant_id=$1 AND page IS NOT NULL
           AND created_at > NOW()-($2||' days')::interval
         GROUP BY page ORDER BY views DESC LIMIT 10`,
        [tenantId, days]
      ),
      this.ds.query(
        `SELECT user_role, COUNT(*)::int as actions FROM analytics_events
         WHERE tenant_id=$1 AND created_at > NOW()-($2||' days')::interval
         GROUP BY user_role ORDER BY actions DESC`,
        [tenantId, days]
      ),
    ]);
    return { events, pages, users_by_role: users };
  }
}
