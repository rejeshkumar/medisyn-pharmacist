import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query,
  UseGuards, Request, HttpCode, HttpStatus, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';
import { PatientsService } from './patients.service';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('patients')
@ApiBearerAuth()
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // ── Public endpoint — VIP self-registration (no auth) ─────────────────────
  @Public()
  @Post('vip-register')
  vipRegister(@Body() dto: VipRegisterDto) {
    return this.patientsService.vipRegister(dto, '00000000-0000-0000-0000-000000000001');
  }

  // ── Protected endpoints ───────────────────────────────────────────────────
  @Get('stats')
  getStats(@Request() req) {
    return this.patientsService.getStats(req.tenantId);
  }

  @Get('appointments/today')
  getTodaySchedule(@Request() req) {
    return this.patientsService.getTodaySchedule(req.tenantId);
  }

  @Get('appointments/missed')
  getMissedAppointments(@Request() req) {
    return this.patientsService.getMissedAppointments(req.tenantId);
  }

  @Get('appointments/upcoming')
  getUpcomingAppointments(@Request() req) {
    return this.patientsService.getUpcomingAppointments(req.tenantId);
  }

  @Get('reminders/due')
  getDueReminders(@Request() req) {
    return this.patientsService.getDueReminders(req.tenantId);
  }

  // ── DPDPA: Consent status report ──────────────────────────────────────────
  @Get('consent-report')
  @ApiOperation({ summary: 'DPDPA — get consent stats for all patients' })
  getConsentReport(@Request() req) {
    return this.patientsService.getConsentReport(req.tenantId);
  }

  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'is_vip', required: false })
  @ApiQuery({ name: 'category', required: false })
  @Get()
  findAll(
    @Request() req,
    @Query('search') search?: string,
    @Query('is_vip') isVip?: string,
    @Query('category') category?: string,
  ) {
    const vipFilter = isVip === 'true' ? true : isVip === 'false' ? false : undefined;
    return this.patientsService.findAll(req.tenantId, search, vipFilter, category);
  }

  @Post()
  create(@Body() dto: CreatePatientDto, @Request() req) {
    return this.patientsService.create(dto, req.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.patientsService.findOne(id, req.tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>, @Request() req) {
    return this.patientsService.update(id, dto, req.user);
  }

  // ── DPDPA: Record patient consent ─────────────────────────────────────────
  @Post(':id/consent')
  @ApiOperation({ summary: 'DPDPA — record patient data consent' })
  recordConsent(
    @Param('id') id: string,
    @Body() body: { consent_given: boolean; consent_version?: string },
    @Req() req: any,
  ) {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    return this.patientsService.recordConsent(id, req.tenantId, body.consent_given, ip, body.consent_version);
  }

  // ── DPDPA: Patient data deletion request ─────────────────────────────────
  @Post(':id/deletion-request')
  @ApiOperation({ summary: 'DPDPA — patient requests data deletion (Right to Erasure)' })
  requestDeletion(
    @Param('id') id: string,
    @Body() body: { reason?: string },
    @Request() req,
  ) {
    return this.patientsService.requestDataDeletion(id, req.tenantId, req.user, body.reason);
  }

  // ── DPDPA: Anonymise patient (Owner only — irreversible) ──────────────────
  @Delete(':id/anonymise')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DPDPA — anonymise patient data (Owner only, irreversible)' })
  anonymisePatient(
    @Param('id') id: string,
    @Request() req,
  ) {
    return this.patientsService.anonymisePatient(id, req.tenantId, req.user);
  }

  // ── Appointments ───────────────────────────────────────────────────────────

  @Get(':id/appointments')
  getAppointments(@Param('id') id: string, @Request() req) {
    return this.patientsService.getAppointments(id, req.tenantId);
  }

  @Post(':id/appointments')
  createAppointment(
    @Param('id') id: string,
    @Body() dto: CreateAppointmentDto,
    @Request() req,
  ) {
    return this.patientsService.createAppointment(id, dto, req.user);
  }

  @Patch('appointments/:apptId')
  updateAppointment(
    @Param('apptId') apptId: string,
    @Body() dto: UpdateAppointmentDto,
    @Request() req,
  ) {
    return this.patientsService.updateAppointment(apptId, dto, req.tenantId);
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  @Get(':id/reminders')
  getReminders(@Param('id') id: string, @Request() req) {
    return this.patientsService.getReminders(id, req.tenantId);
  }

  @Post(':id/reminders')
  createReminder(
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
    @Request() req,
  ) {
    return this.patientsService.createReminder(id, dto, req.user);
  }

  @Patch('reminders/:reminderId/done')
  markReminderDone(@Param('reminderId') reminderId: string, @Request() req) {
    return this.patientsService.markReminderDone(reminderId, req.tenantId);
  }
}
