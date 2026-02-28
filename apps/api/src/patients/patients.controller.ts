import {
  Controller, Get, Post, Patch, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PatientsService } from './patients.service';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  // ── Public endpoint — VIP self-registration (no auth) ─────────────────────
  @Post('vip-register')
  vipRegister(@Body() dto: VipRegisterDto) {
    return this.patientsService.vipRegister(dto);
  }

  // ── Protected endpoints ───────────────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('stats')
  getStats() {
    return this.patientsService.getStats();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('appointments/today')
  getTodaySchedule() {
    return this.patientsService.getTodaySchedule();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('appointments/missed')
  getMissedAppointments() {
    return this.patientsService.getMissedAppointments();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('appointments/upcoming')
  getUpcomingAppointments() {
    return this.patientsService.getUpcomingAppointments();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('reminders/due')
  getDueReminders() {
    return this.patientsService.getDueReminders();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'is_vip', required: false })
  @ApiQuery({ name: 'category', required: false })
  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('is_vip') isVip?: string,
    @Query('category') category?: string,
  ) {
    const vipFilter = isVip === 'true' ? true : isVip === 'false' ? false : undefined;
    return this.patientsService.findAll(search, vipFilter, category);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  create(@Body() dto: CreatePatientDto, @Request() req: any) {
    return this.patientsService.create(dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreatePatientDto>) {
    return this.patientsService.update(id, dto);
  }

  // ── Appointments ───────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/appointments')
  getAppointments(@Param('id') id: string) {
    return this.patientsService.getAppointments(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/appointments')
  createAppointment(
    @Param('id') id: string,
    @Body() dto: CreateAppointmentDto,
    @Request() req: any,
  ) {
    return this.patientsService.createAppointment(id, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('appointments/:apptId')
  updateAppointment(@Param('apptId') apptId: string, @Body() dto: UpdateAppointmentDto) {
    return this.patientsService.updateAppointment(apptId, dto);
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id/reminders')
  getReminders(@Param('id') id: string) {
    return this.patientsService.getReminders(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/reminders')
  createReminder(
    @Param('id') id: string,
    @Body() dto: CreateReminderDto,
    @Request() req: any,
  ) {
    return this.patientsService.createReminder(id, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('reminders/:reminderId/done')
  markReminderDone(@Param('reminderId') reminderId: string) {
    return this.patientsService.markReminderDone(reminderId);
  }
}
