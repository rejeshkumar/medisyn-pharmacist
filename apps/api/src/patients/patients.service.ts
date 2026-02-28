import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as dayjs from 'dayjs';
import { Patient } from '../database/entities/patient.entity';
import { PatientAppointment, AppointmentStatus } from '../database/entities/patient-appointment.entity';
import { PatientReminder } from '../database/entities/patient-reminder.entity';
import { CreatePatientDto, VipRegisterDto } from './dto/create-patient.dto';
import { PartialType } from '@nestjs/swagger';
import { CreateAppointmentDto, UpdateAppointmentDto } from './dto/create-appointment.dto';
import { CreateReminderDto } from './dto/create-reminder.dto';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(PatientAppointment) private apptRepo: Repository<PatientAppointment>,
    @InjectRepository(PatientReminder) private reminderRepo: Repository<PatientReminder>,
  ) {}

  // ── Patients ───────────────────────────────────────────────────────────────

  async findAll(search?: string, isVip?: boolean, category?: string) {
    const qb = this.patientRepo.createQueryBuilder('p').orderBy('p.created_at', 'DESC');
    if (search) {
      qb.where(
        '(p.first_name ILIKE :s OR p.last_name ILIKE :s OR p.mobile ILIKE :s OR p.uhid ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (isVip !== undefined) qb.andWhere('p.is_vip = :v', { v: isVip });
    if (category) qb.andWhere('p.category = :c', { c: category });
    qb.andWhere('p.is_active = true');
    return qb.getMany();
  }

  async findOne(id: string) {
    const p = await this.patientRepo.findOne({
      where: { id },
      relations: ['appointments', 'reminders'],
    });
    if (!p) throw new NotFoundException('Patient not found');
    return p;
  }

  async create(dto: CreatePatientDto, userId: string) {
    const uhid = await this.generateUhid();
    let vip_start = dto.vip_start_date;
    let vip_end = dto.vip_end_date;
    if (dto.is_vip) {
      // Use provided dates, or fall back to today → today + 1 year
      if (!vip_start) vip_start = dayjs().format('YYYY-MM-DD');
      if (!vip_end) vip_end = dayjs(vip_start).add(1, 'year').format('YYYY-MM-DD');
    }
    const patient = this.patientRepo.create({
      ...dto,
      uhid,
      created_by: userId,
      vip_start_date: vip_start,
      vip_end_date: vip_end,
    });
    return this.patientRepo.save(patient);
  }

  async update(id: string, dto: Partial<CreatePatientDto>) {
    const patient = await this.findOne(id);
    // Granting VIP: auto-set dates if not provided
    if (dto.is_vip && !patient.is_vip) {
      const start = dto.vip_start_date || dayjs().format('YYYY-MM-DD');
      const end = dto.vip_end_date || dayjs(start).add(1, 'year').format('YYYY-MM-DD');
      (dto as any).vip_start_date = start;
      (dto as any).vip_end_date = end;
    }
    // Renewing VIP (already VIP, new dates given)
    if (dto.is_vip && patient.is_vip && dto.vip_start_date && !dto.vip_end_date) {
      (dto as any).vip_end_date = dayjs(dto.vip_start_date).add(1, 'year').format('YYYY-MM-DD');
    }
    Object.assign(patient, dto);
    return this.patientRepo.save(patient);
  }

  async vipRegister(dto: VipRegisterDto) {
    // Check if patient already exists by mobile
    let patient = await this.patientRepo.findOne({ where: { mobile: dto.mobile } });
    const vipStart = dayjs().format('YYYY-MM-DD');
    const vipEnd = dayjs().add(1, 'year').format('YYYY-MM-DD');

    if (patient) {
      patient.is_vip = true;
      patient.vip_start_date = vipStart;
      patient.vip_end_date = vipEnd;
      patient.vip_registered_by = dto.vip_registered_by || 'Sales Team';
      if (dto.first_name) patient.first_name = dto.first_name;
      if (dto.last_name) patient.last_name = dto.last_name;
      if (dto.email) patient.email = dto.email;
      if (dto.area) patient.area = dto.area;
      if (dto.address) patient.address = dto.address;
      return this.patientRepo.save(patient);
    }

    const uhid = await this.generateUhid();
    patient = this.patientRepo.create({
      ...dto,
      uhid,
      is_vip: true,
      vip_start_date: vipStart,
      vip_end_date: vipEnd,
      vip_registered_by: dto.vip_registered_by || 'Sales Team',
      category: 'general' as any,
    });
    return this.patientRepo.save(patient);
  }

  async getStats() {
    const today = dayjs().format('YYYY-MM-DD');
    const [totalPatients, vipPatients, todayAppointments, missedCount] = await Promise.all([
      this.patientRepo.count({ where: { is_active: true } }),
      this.patientRepo.count({ where: { is_vip: true, is_active: true } }),
      this.apptRepo.count({ where: { appointment_date: today, status: AppointmentStatus.SCHEDULED } }),
      this.apptRepo.count({ where: { status: AppointmentStatus.MISSED } }),
    ]);
    return { totalPatients, vipPatients, todayAppointments, missedCount };
  }

  // ── Appointments ───────────────────────────────────────────────────────────

  async getAppointments(patientId: string) {
    await this.autoMarkMissed(patientId);
    return this.apptRepo.find({
      where: { patient_id: patientId },
      order: { appointment_date: 'DESC' },
    });
  }

  async createAppointment(patientId: string, dto: CreateAppointmentDto, userId: string) {
    await this.findOne(patientId);
    const appt = this.apptRepo.create({ ...dto, patient_id: patientId, created_by: userId });
    const saved = await this.apptRepo.save(appt);
    // Auto-create a reminder 1 day before
    const remindAt = dayjs(dto.appointment_date).subtract(1, 'day').toDate();
    if (remindAt > new Date()) {
      await this.reminderRepo.save(
        this.reminderRepo.create({
          patient_id: patientId,
          appointment_id: saved.id,
          title: `Appointment reminder`,
          message: `You have a ${dto.type || 'consultation'} appointment scheduled for ${dto.appointment_date}${dto.appointment_time ? ' at ' + dto.appointment_time : ''}.`,
          remind_at: remindAt,
          type: 'appointment' as any,
          created_by: userId,
        }),
      );
    }
    return saved;
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto) {
    const appt = await this.apptRepo.findOne({ where: { id } });
    if (!appt) throw new NotFoundException('Appointment not found');
    Object.assign(appt, dto);
    return this.apptRepo.save(appt);
  }

  async getTodaySchedule() {
    const today = dayjs().format('YYYY-MM-DD');
    return this.apptRepo.find({
      where: { appointment_date: today, status: AppointmentStatus.SCHEDULED },
      relations: ['patient'],
      order: { appointment_time: 'ASC' },
    });
  }

  async getMissedAppointments() {
    return this.apptRepo.find({
      where: { status: AppointmentStatus.MISSED },
      relations: ['patient'],
      order: { appointment_date: 'DESC' },
    });
  }

  async getUpcomingAppointments() {
    const today = dayjs().format('YYYY-MM-DD');
    return this.apptRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.patient', 'p')
      .where('a.appointment_date >= :today', { today })
      .andWhere('a.status = :s', { s: AppointmentStatus.SCHEDULED })
      .orderBy('a.appointment_date', 'ASC')
      .addOrderBy('a.appointment_time', 'ASC')
      .limit(50)
      .getMany();
  }

  private async autoMarkMissed(patientId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    await this.apptRepo
      .createQueryBuilder()
      .update(PatientAppointment)
      .set({ status: AppointmentStatus.MISSED })
      .where('patient_id = :pid', { pid: patientId })
      .andWhere('appointment_date < :today', { today })
      .andWhere('status = :s', { s: AppointmentStatus.SCHEDULED })
      .execute();
  }

  // ── Reminders ──────────────────────────────────────────────────────────────

  async getReminders(patientId: string) {
    return this.reminderRepo.find({
      where: { patient_id: patientId },
      order: { remind_at: 'ASC' },
    });
  }

  async createReminder(patientId: string, dto: CreateReminderDto, userId: string) {
    await this.findOne(patientId);
    const reminder = this.reminderRepo.create({
      ...dto,
      patient_id: patientId,
      remind_at: new Date(dto.remind_at),
      created_by: userId,
    });
    return this.reminderRepo.save(reminder);
  }

  async markReminderDone(id: string) {
    const reminder = await this.reminderRepo.findOne({ where: { id } });
    if (!reminder) throw new NotFoundException('Reminder not found');
    reminder.is_done = true;
    return this.reminderRepo.save(reminder);
  }

  async getDueReminders() {
    return this.reminderRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.patient', 'p')
      .where('r.remind_at <= :now', { now: new Date() })
      .andWhere('r.is_done = false')
      .orderBy('r.remind_at', 'ASC')
      .getMany();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async generateUhid(): Promise<string> {
    const count = await this.patientRepo.count();
    const date = dayjs().format('YYYYMMDD');
    return `MED-${date}-${String(count + 1).padStart(4, '0')}`;
  }
}
