import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorAvailability, DoctorLeave } from './availability.entity';
import { UpsertAvailabilityDto, AddLeaveDto } from './availability.dto';
import { UserContext } from '../sales/sales.service';

export interface TimeSlot {
  time: string;       // 'HH:MM'
  datetime: string;   // ISO string
  available: boolean;
  booked_count: number;
  max_patients: number;
}

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(DoctorAvailability)
    private availRepo: Repository<DoctorAvailability>,
    @InjectRepository(DoctorLeave)
    private leaveRepo: Repository<DoctorLeave>,
  ) {}

  // ── Get full weekly schedule for a doctor ──────────────────────────
  async getSchedule(doctorId: string, tenantId: string): Promise<DoctorAvailability[]> {
    return this.availRepo.find({
      where: { doctor_id: doctorId, tenant_id: tenantId },
      order: { day_of_week: 'ASC' },
    });
  }

  // ── Upsert a day's schedule ────────────────────────────────────────
  async upsertDay(
    doctorId: string,
    tenantId: string,
    dto: UpsertAvailabilityDto,
  ): Promise<DoctorAvailability> {
    let existing = await this.availRepo.findOne({
      where: { doctor_id: doctorId, tenant_id: tenantId, day_of_week: dto.day_of_week },
    });

    if (existing) {
      Object.assign(existing, {
        start_time: dto.start_time,
        end_time: dto.end_time,
        slot_duration_mins: dto.slot_duration_mins ?? existing.slot_duration_mins,
        max_patients_per_slot: dto.max_patients_per_slot ?? existing.max_patients_per_slot,
        is_active: dto.is_active ?? existing.is_active,
      });
      return this.availRepo.save(existing);
    }

    const created = this.availRepo.create({
      doctor_id: doctorId,
      tenant_id: tenantId,
      day_of_week: dto.day_of_week,
      start_time: dto.start_time,
      end_time: dto.end_time,
      slot_duration_mins: dto.slot_duration_mins ?? 10,
      max_patients_per_slot: dto.max_patients_per_slot ?? 1,
      is_active: dto.is_active ?? true,
    });
    return this.availRepo.save(created);
  }

  // ── Remove a day ───────────────────────────────────────────────────
  async removeDay(doctorId: string, tenantId: string, dayOfWeek: number): Promise<void> {
    await this.availRepo.delete({ doctor_id: doctorId, tenant_id: tenantId, day_of_week: dayOfWeek });
  }

  // ── Get leaves ────────────────────────────────────────────────────
  async getLeaves(doctorId: string, tenantId: string): Promise<DoctorLeave[]> {
    return this.leaveRepo.find({
      where: { doctor_id: doctorId, tenant_id: tenantId },
      order: { leave_date: 'ASC' },
    });
  }

  // ── Add leave ─────────────────────────────────────────────────────
  async addLeave(doctorId: string, tenantId: string, dto: AddLeaveDto): Promise<DoctorLeave> {
    const existing = await this.leaveRepo.findOne({
      where: { doctor_id: doctorId, tenant_id: tenantId, leave_date: dto.leave_date },
    });
    if (existing) return existing;

    const leave = this.leaveRepo.create({
      doctor_id: doctorId,
      tenant_id: tenantId,
      leave_date: dto.leave_date,
      reason: dto.reason,
    });
    return this.leaveRepo.save(leave);
  }

  // ── Remove leave ──────────────────────────────────────────────────
  async removeLeave(leaveId: string, tenantId: string): Promise<void> {
    await this.leaveRepo.delete({ id: leaveId, tenant_id: tenantId });
  }

  // ── Get available slots for a doctor on a date ────────────────────
  async getSlots(
    doctorId: string,
    tenantId: string,
    date: string,
    dataSource: any,
  ): Promise<{ is_available: boolean; reason?: string; slots: TimeSlot[] }> {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0=Sun

    // Check leave
    const onLeave = await this.leaveRepo.findOne({
      where: { doctor_id: doctorId, tenant_id: tenantId, leave_date: date },
    });
    if (onLeave) {
      return { is_available: false, reason: onLeave.reason || 'Doctor on leave', slots: [] };
    }

    // Get schedule for this day
    const schedule = await this.availRepo.findOne({
      where: { doctor_id: doctorId, tenant_id: tenantId, day_of_week: dayOfWeek, is_active: true },
    });
    if (!schedule) {
      return { is_available: false, reason: 'Doctor not available on this day', slots: [] };
    }

    // Get existing bookings for this doctor on this date
    const bookings = await dataSource.query(
      `SELECT scheduled_time FROM queues 
       WHERE tenant_id = $1 AND doctor_id = $2 AND slot_date = $3 
       AND status NOT IN ('cancelled', 'no_show')`,
      [tenantId, doctorId, date],
    );
    const bookedTimes = bookings.map((b: any) => {
      const t = new Date(b.scheduled_time);
      return `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`;
    });

    // Generate slots
    const slots: TimeSlot[] = [];
    const [startH, startM] = schedule.start_time.split(':').map(Number);
    const [endH, endM] = schedule.end_time.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    for (let mins = startMins; mins < endMins; mins += schedule.slot_duration_mins) {
      const h = Math.floor(mins / 60).toString().padStart(2, '0');
      const m = (mins % 60).toString().padStart(2, '0');
      const time = `${h}:${m}`;
      const bookedCount = bookedTimes.filter((t: string) => t === time).length;
      slots.push({
        time,
        datetime: `${date}T${time}:00`,
        available: bookedCount < schedule.max_patients_per_slot,
        booked_count: bookedCount,
        max_patients: schedule.max_patients_per_slot,
      });
    }

    return { is_available: true, slots };
  }
}
