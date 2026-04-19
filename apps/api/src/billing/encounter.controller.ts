import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { EncounterServicesService } from './encounter.service';
import { EncounterServiceStatus } from './encounter-service.entity';

@Controller('encounters')
@UseGuards(JwtAuthGuard, TenantGuard)
export class EncounterController {
  constructor(private readonly svc: EncounterServicesService) {}

  // ── Today's encounters for receptionist ──────────────────────
  @Get('today')
  getTodayEncounters(@Req() req: any) {
    return this.svc.getTodayEncounters(req.user.tenant_id);
  }

  // ── Pending services by role (nurse, lab) ────────────────────
  @Get('pending')
  getPending(@Query('role') role: string, @Req() req: any) {
    return this.svc.getPendingByRole(req.user.tenant_id, role ?? 'nurse');
  }

  // ── Encounter summary for a queue entry ──────────────────────
  @Get(':queueId/summary')
  getSummary(@Param('queueId') queueId: string, @Req() req: any) {
    return this.svc.getEncounterSummary(queueId, req.user.tenant_id);
  }

  // ── Services for a queue entry ────────────────────────────────
  @Get(':queueId/services')
  getServices(@Param('queueId') queueId: string, @Req() req: any) {
    return this.svc.getByQueue(queueId, req.user.tenant_id);
  }

  // ── Order a service ───────────────────────────────────────────
  @Post(':queueId/services')
  orderService(
    @Param('queueId') queueId: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.svc.orderService(req.user.tenant_id, {
      ...body,
      queue_id:      queueId,
      ordered_by:    req.user.id,
      ordered_by_role: req.user.role,
    });
  }

  // ── Update service status ────────────────────────────────────
  @Patch('services/:id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: EncounterServiceStatus; notes?: string },
    @Req() req: any,
  ) {
    return this.svc.updateStatus(id, req.user.tenant_id, body.status, req.user.id, body.notes);
  }

  // ── Cancel a service ──────────────────────────────────────────
  @Delete('services/:id')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.svc.cancel(id, req.user.tenant_id);
  }
}
