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

  // POST /queue — register patient in queue
  @Post()
  register(@Body() dto: CreateQueueDto, @Req() req: any) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.queueService.register(dto, req.tenantId, user);
  }

  // GET /queue/today — today's full queue
  @Get('today')
  getTodayQueue(@Req() req: any, @Query('doctor_id') doctorId?: string) {
    return this.queueService.getTodayQueue(req.tenantId, doctorId);
  }

  // GET /queue/today/stats — today's queue stats
  @Get('today/stats')
  getTodayStats(@Req() req: any) {
    return this.queueService.getTodayStats(req.tenantId);
  }

  // GET /queue/:id/precheck — get pre-check for a queue entry
  // (must be before /:id to avoid route conflict)
  @Get(':id/precheck')
  getPreCheck(@Param('id') id: string, @Req() req: any) {
    return this.queueService.getPreCheckByQueue(id, req.tenantId);
  }

  // GET /queue/:id — single queue entry
  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.queueService.getById(id, req.tenantId);
  }

  // PATCH /queue/:id/status — update queue status
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateQueueStatusDto,
    @Req() req: any,
  ) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.queueService.updateStatus(id, dto, req.tenantId, user);
  }

  // POST /queue/precheck — record vitals
  @Post('precheck')
  recordPreCheck(@Body() dto: RecordPreCheckDto, @Req() req: any) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.queueService.recordPreCheck(dto, req.tenantId, user);
  }
}
