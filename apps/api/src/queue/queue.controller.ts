import {
  Controller, Get, Post, Patch, Param, Body, Req, Query, UseGuards,
} from '@nestjs/common';
import { QueueService } from './queue.service';
import { CreateQueueDto, UpdateQueueStatusDto, RecordPreCheckDto } from './queue.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { UserContext } from '../sales/sales.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post()
  register(@Body() dto: CreateQueueDto, @Req() req: any) {
    const user: UserContext = { id: req.user.id, full_name: req.user.full_name, role: req.user.role, tenant_id: req.tenantId };
    return this.queueService.register(dto, req.tenantId, user);
  }

  @Get('today')
  getTodayQueue(@Req() req: any, @Query('doctor_id') doctorId?: string) {
    return this.queueService.getTodayQueue(req.tenantId, doctorId);
  }

  @Get('today/stats')
  getTodayStats(@Req() req: any) {
    return this.queueService.getTodayStats(req.tenantId);
  }

  @Get(':id/precheck')
  getPreCheck(@Param('id') id: string, @Req() req: any) {
    return this.queueService.getPreCheckByQueue(id, req.tenantId);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.queueService.getById(id, req.tenantId);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateQueueStatusDto, @Req() req: any) {
    const user: UserContext = { id: req.user.id, full_name: req.user.full_name, role: req.user.role, tenant_id: req.tenantId };
    return this.queueService.updateStatus(id, dto, req.tenantId, user);
  }

  // PATCH /queue/:id/pull — doctor pulls patient directly to consultation (bypasses precheck)
  @Patch(':id/pull')
  pullToConsultation(@Param('id') id: string, @Req() req: any) {
    const user: UserContext = { id: req.user.id, full_name: req.user.full_name, role: req.user.role, tenant_id: req.tenantId };
    return this.queueService.pullToConsultation(id, req.tenantId, user);
  }

  // PATCH /queue/:id/priority — mark urgent or deprioritize
  @Patch(':id/priority')
  updatePriority(
    @Param('id') id: string,
    @Body() body: { action: 'urgent' | 'deprioritize'; reason?: string },
    @Req() req: any,
  ) {
    const user: UserContext = { id: req.user.id, full_name: req.user.full_name, role: req.user.role, tenant_id: req.tenantId };
    const status = body.action === 'urgent' ? 'emergency' : 'waiting';
    return this.queueService.updateStatus(id, { status, override_reason: body.reason }, req.tenantId, user);
  }

  @Post('precheck')
  recordPreCheck(@Body() dto: RecordPreCheckDto, @Req() req: any) {
    const user: UserContext = { id: req.user.id, full_name: req.user.full_name, role: req.user.role, tenant_id: req.tenantId };
    return this.queueService.recordPreCheck(dto, req.tenantId, user);
  }
}
