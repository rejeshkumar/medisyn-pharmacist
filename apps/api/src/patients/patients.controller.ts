import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
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
  // NOTE: vip-register is public but has no tenant context from JWT.
  // It uses a fixed default tenant for walk-in kiosk registrations.
  // In Phase 2 this will accept a tenant slug as a query param.
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
