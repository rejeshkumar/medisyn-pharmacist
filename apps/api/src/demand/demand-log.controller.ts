// ============================================================
// apps/api/src/demand/demand-log.controller.ts
// ============================================================
import { Controller, Post, Get, Patch, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { DemandLogService, LogDemandDto } from './demand-log.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('demand-log')
@UseGuards(JwtAuthGuard)
export class DemandLogController {
  constructor(private readonly svc: DemandLogService) {}

  /** POST /demand-log — log a missed demand with auto-validation */
  @Post()
  log(@Body() dto: LogDemandDto, @Request() req) {
    return this.svc.logDemand(dto, req.user.sub, req.user.tenant_id);
  }

  /** GET /demand-log/summary?days=7 — weekly demand summary for dashboard */
  @Get('summary')
  summary(@Query('days') days: string, @Request() req) {
    return this.svc.getSummary(req.user.tenant_id, parseInt(days || '7', 10));
  }

  /** GET /demand-log?status=open — full list */
  @Get()
  list(@Query('status') status: string, @Request() req) {
    return this.svc.list(req.user.tenant_id, status);
  }

  /** PATCH /demand-log/:id/resolve — mark stocked/dismissed/added_to_po */
  @Patch(':id/resolve')
  resolve(
    @Param('id') id: string,
    @Body() body: { resolution: 'stocked' | 'dismissed' | 'added_to_po' },
    @Request() req,
  ) {
    return this.svc.resolve(id, body.resolution, req.user.sub, req.user.tenant_id);
  }
}

// ============================================================
// apps/api/src/demand/demand-log.module.ts
// ============================================================
// Add this file, then import DemandLogModule in app.module.ts

// import { Module } from '@nestjs/common';
// import { DemandLogController } from './demand-log.controller';
// import { DemandLogService } from './demand-log.service';
//
// @Module({
//   controllers: [DemandLogController],
//   providers: [DemandLogService],
//   exports: [DemandLogService],
// })
// export class DemandLogModule {}
