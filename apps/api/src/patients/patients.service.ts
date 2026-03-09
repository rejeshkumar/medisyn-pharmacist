import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as dayjs from 'dayjs';
import { Patient } from '../database/entities/patient.entity';
import { PatientAppointment, AppointmentStatus } from '../database/entities/patient-appointment.entity';
import { PatientReminder } from '../database/entities/patient-reminder.entity';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(PatientAppointment)
    private apptRepo: Repository<PatientAppointment>,
    @InjectRepository(PatientReminder)
    private reminderRepo: Repository<PatientReminder>,
    private auditService: AuditService,
  ) {}

  // ── Patients ───────────────────────────────────────────────────────────────

  async findAll(tenantId: string, search?: string, isVip?: boolean, category?: string) {
    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.is_active = true')
      .orderBy('p.created_at', 'DESC');

    if (search) {
      qb.andWhere(
        '(p.first_name ILIKE :s OR p.last_name ILIKE :s OR p.mobile ILIKE :s OR p.uhid ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (isVip !== undefined) qb.andWhere('p.is_vip = :v', { v: isVip });
    if (category)            qb.andWhere('p.category = :c', { c: category });

    return qb.getMany();
  }

  async findOne(id: string, tenantId: string) {
    const p = await this.patientRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['appointments', 'reminders'],
    });
    if (!p) throw new NotFoundException('Patient not found');
    return p;
  }

  async create(dto: CreatePatientDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const uhid = await this.generateUhid(tenantId);

    let vip_start = dto.vip_start_date;
    let vip_end   = dto.vip_end_date;
    if (dto.is_vip) {
      if (!vip_start) vip_start = dayjs().format('YYYY-MM-DD');
      if (!vip_end)   vip_end   = dayjs(vip_start).add(1, 'year').format('YYYY-MM-DD');
    }

    const patient = this.patientRepo.create({
      ...dto,
      uhid,
      tenant_id:      tenantId,
      created_by:     userId,
      vip_start_date: vip_start,
      vip_end_date:   vip_end,
    });
    const saved = await this.patientRepo.save(patient);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.CREATE,
      entity:    'Patient',
      entityId:  saved.id,
      entityRef: `${saved.first_name} ${saved.last_name || ''} — ${saved.uhid}`,
      newValue:  { uhid: saved.uhid, mobile: saved.mobile, is_vip: saved.is_vip },
    });

    return saved;
  }

  async update(id: string, dto: Partial<CreatePatientDto>, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const patient = await this.findOne(id, tenantId);

    if (dto.is_vip && !patient.is_vip) {
      const start = dto.vip_start_date || dayjs().format('YYYY-MM-DD');
      const end   = dto.vip_end_date   || dayjs(start).add(1, 'year').format('YYYY-MM-DD');
      (dto as any).vip_start_date = start;
      (dto as any).vip_end_date   = end;
    }
    if (dto.is_vip && patient.is_vip && dto.vip_start_date && !dto.vip_end_date) {
      (dto as any).vip_end_date = dayjs(dto.vip_start_date).add(1, 'year').format('YYYY-MM-DD');
    }

    const oldValue = { first_name: patient.first_name, mobile: patient.mobile, is_vip: patient.is_vip };
    Object.assign(patient, dto);
    patient.updated_by = userId;
    const saved = await this.patientRepo.save(patient);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.UPDATE,
      entity:    'Patient',
      entityId:  id,
      entityRef: `${patient.first_name} ${patient.last_name || ''} — ${patient.uhid}`,
      oldValue,
      newValue:  dto as Record<string, any>,
    });

    return saved;
  }

  async vipRegister(dto: VipRegisterDto, tenantId: string) {
    let patient = await this.patientRepo.findOne({
      where: { mobile: dto.mobile, tenant_id: tenantId },
    });
    const vipStart = dayjs().format('YYYY-MM-DD');
    const vipEnd   = dayjs().add(1, 'year').format('YYYY-MM-DD');

    if (patient) {
      patient.is_vip              = true;
      patient.vip_start_date      = vipStart;
      patient.vip_end_date        = vipEnd;
      patient.vip_registered_by   = dto.vip_registered_by || 'Sales Team';
      if (dto.first_name) patient.first_name = dto.first_name;
      if (dto.last_name)  patient.last_name  = dto.last_name;
      if (dto.email)      patient.email      = dto.email;
      if (dto.area)       patient.area       = dto.area;
      if (dto.address)    patient.address    = dto.address;
      return this.patientRepo.save(patient);
    }

    const uhid = await this.generateUhid(tenantId);
    patient = this.patientRepo.create({
      ...dto,
      uhid,
      tenant_id:          tenantId,
      is_vip:             true,
      vip_start_date:     vipStart,
      vip_end_date:       vipEnd,
      vip_registered_by:  dto.vip_registered_by || 'Sales Team',
      category:           'general' as any,
    });
    return this.patientRepo.save(patient);
  }

  async getStats(tenantId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    const [totalPatients, vipPatients, todayAppointments, missedCount] = await Promise.all([
      this.patientRepo.count({ where: { is_active: true, tenant_id: tenantId } }),
      this.patientRepo.count({ where: { is_vip: true, is_active: true, tenant_id: tenantId } }),
      this.apptRepo.count({ where: { appointment_date: today, status: AppointmentStatus.SCHEDULED, tenant_id: tenantId } }),
      this.apptRepo.count({ where: { status: AppointmentStatus.MISSED, tenant_id: tenantId } }),
    ]);
    return { totalPatients, vipPatients, todayAppointments, missedCount };
  }

  // ── Appointments ───────────────────────────────────────────────────────────

  async getAppointments(patientId: string, tenantId: string) {
    await this.autoMarkMissed(patientId, tenantId);
    return this.apptRepo.find({
      where: { patient_id: patientId, tenant_id: tenantId },
      order: { appointment_date: 'DESC' },
    });
  }

  async createAppointment(patientId: string, dto: CreateAppointmentDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    await this.findOne(patientId, tenantId);

    const appt = this.apptRepo.create({
      ...dto,
      patient_id: patientId,
      tenant_id:  tenantId,
      created_by: userId,
    });
    const saved = await this.apptRepo.save(appt);

    const remindAt = dayjs(dto.appointment_date).subtract(1, 'day').toDate();
    if (remindAt > new Date()) {
      await this.reminderRepo.save(
        this.reminderRepo.create({
          patient_id:     patientId,
          appointment_id: saved.id,
          title:          'Appointment reminder',
          message:        `You have a ${dto.type || 'consultation'} appointment scheduled for ${dto.appointment_date}${dto.appointment_time ? ' at ' + dto.appointment_time : ''}.`,
          remind_at:      remindAt,
          type:           'appointment' as any,
          created_by:     userId,
          tenant_id:      tenantId,
        }),
      );
    }
    return saved;
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto, tenantId: string) {
    const appt = await this.apptRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!appt) throw new NotFoundException('Appointment not found');
    Object.assign(appt, dto);
    return this.apptRepo.save(appt);
  }

  async getTodaySchedule(tenantId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    return this.apptRepo.find({
      where: { appointment_date: today, status: AppointmentStatus.SCHEDULED, tenant_id: tenantId },
      relations: ['patient'],
      order: { appointment_time: 'ASC' },
    });
  }

  async getMissedAppointments(tenantId: string) {
    return this.apptRepo.find({
      where: { status: AppointmentStatus.MISSED, tenant_id: tenantId },
      relations: ['patient'],
      order: { appointment_date: 'DESC' },
    });
  }

  async getUpcomingAppointments(tenantId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    return this.apptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'p')
      .where('a.tenant_id = :tenantId', { tenantId })
      .andWhere('a.appointment_date >= :today', { today })
      .andWhere('a.status = :s', { s: AppointmentStatus.SCHEDULED })
      .orderBy('a.appointment_date', 'ASC')
      .addOrderBy('a.appointment_time', 'ASC')
      .limit(50)
      .getMany();
  }

  private async autoMarkMissed(patientId: string, tenantId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    await this.apptRepo
      .createQueryBuilder()
      .update(PatientAppointment)
      .set({ status: AppointmentStatus.MISSED })
      .where('patient_id = :pid',  { pid: patientId })
      .andWhere('tenant_id = :tenantId', { tenantId })
      .andWhere('appointment_date < :today', { today })
      .andWhere('status = :s', { s: AppointmentStatus.SCHEDULED })
      .execute();
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  async getReminders(patientId: string, tenantId: string) {
    return this.reminderRepo.find({
      where: { patient_id: patientId, tenant_id: tenantId },
      order: { remind_at: 'ASC' },
    });
  }

  async createReminder(patientId: string, dto: CreateReminderDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    await this.findOne(patientId, tenantId);
    const reminder = this.reminderRepo.create({
      ...dto,
      patient_id: patientId,
      remind_at:  new Date(dto.remind_at),
      created_by: userId,
      tenant_id:  tenantId,
    });
    return this.reminderRepo.save(reminder);
  }

  async markReminderDone(id: string, tenantId: string) {
    const reminder = await this.reminderRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!reminder) throw new NotFoundException('Reminder not found');
    reminder.is_done = true;
    return this.reminderRepo.save(reminder);
  }

  async getDueReminders(tenantId: string) {
    return this.reminderRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.patient', 'p')
      .where('r.tenant_id = :tenantId', { tenantId })
      .andWhere('r.remind_at <= :now', { now: new Date() })
      .andWhere('r.is_done = false')
      .orderBy('r.remind_at', 'ASC')
      .getMany();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async generateUhid(tenantId: string): Promise<string> {
    const count = await this.patientRepo.count({ where: { tenant_id: tenantId } });
    const date  = dayjs().format('YYYYMMDD');
    return `MED-${date}-${String(count + 1).padStart(4, '0')}`;
  }
}
