import { Controller, Get, Patch, Body, Query, Req, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('audit')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  // GET /audit/logs?action=&entity=&from=&to=&page=&limit=
  @Get('logs')
  getLogs(@Query() query: any, @Req() req: any) {
    return this.auditService.getLogs(req.user.tenant_id, {
      action: query.action,
      entity: query.entity,
      userId: query.userId,
      from:   query.from,
      to:     query.to,
      page:   query.page   ? parseInt(query.page)  : 1,
      limit:  query.limit  ? parseInt(query.limit) : 50,
    });
  }

  // GET /audit/config — get current tenant audit settings
  @Get('config')
  getConfig(@Req() req: any) {
    return this.auditService.getConfigForTenant(req.user.tenant_id);
  }

  // PATCH /audit/config — update audit settings (owner/admin only)
  @Patch('config')
  updateConfig(@Body() body: any, @Req() req: any) {
    const user = req.user;
    const roles: string[] = user.roles?.length ? user.roles : [user.role];
    if (!roles.some((r: string) => ['owner', 'admin'].includes(r))) {
      return { error: 'Only owners and admins can change audit settings' };
    }
    // Strip non-config fields from body
    const allowed = [
      'log_login_events', 'log_bulk_imports', 'log_queue_booking',
      'log_consultation', 'log_patient_changes', 'log_report_views',
      'log_availability_changes',
    ];
    const updates: any = {};
    allowed.forEach(k => { if (body[k] !== undefined) updates[k] = body[k]; });
    return this.auditService.updateConfig(user.tenant_id, updates);
  }
}
