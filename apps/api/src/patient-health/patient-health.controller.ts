import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PatientHealthService } from './patient-health.service';

@Controller('patient-health')
@UseGuards(JwtAuthGuard)
export class PatientHealthController {
  constructor(private readonly svc: PatientHealthService) {}

  @Get(':patientId/summary')
  summary(@Param('patientId') id: string, @Request() req: any) {
    return this.svc.getSummary(id, req.user.tenant_id);
  }

  @Get(':patientId/timeline')
  timeline(@Param('patientId') id: string, @Request() req: any) {
    return this.svc.getTimeline(id, req.user.tenant_id);
  }

  @Get(':patientId/brief')
  brief(@Param('patientId') id: string, @Request() req: any) {
    return this.svc.getAiBrief(id, req.user.tenant_id);
  }

  @Get(':patientId/vitals-chart')
  vitalsChart(@Param('patientId') id: string, @Request() req: any) {
    return this.svc.getVitalsChart(id, req.user.tenant_id);
  }

  @Post(':patientId/recompute')
  recompute(@Param('patientId') id: string, @Request() req: any) {
    return this.svc.recomputeSummary(id, req.user.tenant_id);
  }
}
