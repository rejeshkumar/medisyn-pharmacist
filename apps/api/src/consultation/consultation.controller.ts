import {
  Controller, Get, Post, Patch, Param, Body, Req, UseGuards,
} from '@nestjs/common';
import { ConsultationService } from './consultation.service';
import { CreateConsultationDto, UpdateConsultationDto, CreatePrescriptionDto } from './consultation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { UserContext } from '../sales/sales.service';

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('consultations')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  // POST /consultations — start a consultation
  @Post()
  start(@Body() dto: CreateConsultationDto, @Req() req: any) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.consultationService.startConsultation(dto, req.tenantId, user);
  }

  // GET /consultations/:id — get by ID
  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.consultationService.getById(id, req.tenantId);
  }

  // GET /consultations/queue/:queueId — get by queue
  @Get('queue/:queueId')
  getByQueue(@Param('queueId') queueId: string, @Req() req: any) {
    return this.consultationService.getByQueue(queueId, req.tenantId);
  }

  // GET /consultations/patient/:patientId — consultation history
  @Get('patient/:patientId')
  getByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    return this.consultationService.getByPatient(patientId, req.tenantId);
  }

  // PATCH /consultations/:id — update in-progress consultation notes
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
    @Req() req: any,
  ) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.consultationService.updateConsultation(id, dto, req.tenantId, user);
  }

  // PATCH /consultations/:id/complete — complete consultation
  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: UpdateConsultationDto,
    @Req() req: any,
  ) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.consultationService.completeConsultation(id, dto, req.tenantId, user);
  }
}

@UseGuards(JwtAuthGuard, TenantGuard)
@Controller('prescriptions')
export class PrescriptionController {
  constructor(private readonly consultationService: ConsultationService) {}

  // POST /prescriptions — create prescription
  @Post()
  create(@Body() dto: CreatePrescriptionDto, @Req() req: any) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.consultationService.createPrescription(dto, req.tenantId, user);
  }

  // GET /prescriptions/:id — get by ID
  @Get(':id')
  getById(@Param('id') id: string, @Req() req: any) {
    return this.consultationService.getPrescriptionById(id, req.tenantId);
  }

  // GET /prescriptions/patient/:patientId — patient's prescription history
  @Get('patient/:patientId')
  getByPatient(@Param('patientId') patientId: string, @Req() req: any) {
    return this.consultationService.getPrescriptionsByPatient(patientId, req.tenantId);
  }

  // GET /prescriptions/consultation/:consultationId — prescription for a consultation
  @Get('consultation/:consultationId')
  getByConsultation(@Param('consultationId') consultationId: string, @Req() req: any) {
    return this.consultationService.getPrescriptionByConsultation(consultationId, req.tenantId);
  }

  // PATCH /prescriptions/:id/dispense — mark as dispensed
  @Patch(':id/dispense')
  markDispensed(
    @Param('id') id: string,
    @Body() body: { sale_id: string },
    @Req() req: any,
  ) {
    const user: UserContext = {
      id: req.user.id,
      full_name: req.user.full_name,
      role: req.user.role,
      tenant_id: req.tenantId,
    };
    return this.consultationService.markDispensed(id, body.sale_id, req.tenantId, user);
  }
}
