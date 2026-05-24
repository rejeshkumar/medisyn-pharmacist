import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
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
import { SalesAgentsService } from '../sales-agents/sales-agents.service';
import { VipRegistration } from '../database/entities/vip-registration.entity';
import { VipRegisterEnhancedDto } from './dto/create-patient-vip-enhanced.dto';
import { ConfigService } from '@nestjs/config';

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

    @InjectRepository(VipRegistration)
    private vipRegRepo: Repository<VipRegistration>,
    private salesAgentService: SalesAgentsService,
    private configService: ConfigService) {}

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

    // DPDPA: record consent at registration if provided
    const consentTimestamp = dto.consent_given ? new Date() : null;

    const patient = this.patientRepo.create({
      ...dto,
      uhid,
      tenant_id:         tenantId,
      created_by:        userId,
      vip_start_date:    vip_start,
      vip_end_date:      vip_end,
      consent_given:     dto.consent_given ?? false,
      consent_timestamp: consentTimestamp,
      consent_version:   dto.consent_given ? (dto.consent_version ?? '1.0') : null,
    });
    const saved = await this.patientRepo.save(patient) as Patient;

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.CREATE,
      entity:    'Patient',
      entityId:  saved.id,
      entityRef: `${saved.first_name} ${saved.last_name || ''} — ${saved.uhid}`,
      newValue:  { uhid: saved.uhid, mobile: saved.mobile, is_vip: saved.is_vip, consent_given: saved.consent_given },
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

  // ── DPDPA: Record consent ──────────────────────────────────────────────────
  async recordConsent(
    patientId: string,
    tenantId: string,
    consentGiven: boolean,
    ip: string,
    version = '1.0',
  ) {
    const patient = await this.findOne(patientId, tenantId);
    patient.consent_given     = consentGiven;
    patient.consent_timestamp = consentGiven ? new Date() : null;
    patient.consent_ip        = ip;
    patient.consent_version   = consentGiven ? version : null;
    await this.patientRepo.save(patient);
    return {
      id:                patientId,
      consent_given:     patient.consent_given,
      consent_timestamp: patient.consent_timestamp,
      consent_version:   patient.consent_version,
    };
  }

  // ── DPDPA: Request data deletion ──────────────────────────────────────────
  async requestDataDeletion(
    patientId: string,
    tenantId: string,
    user: UserContext,
    reason?: string,
  ) {
    const patient = await this.findOne(patientId, tenantId);
    patient.data_deletion_requested_at = new Date();
    patient.data_deletion_reason       = reason || 'Patient requested data erasure (DPDPA Right to Erasure)';
    await this.patientRepo.save(patient);

    await this.auditService.log({
      tenantId,
      userId:   user.id,
      userName: user.full_name,
      userRole: user.role,
      action:   AuditAction.UPDATE,
      entity:   'Patient',
      entityId: patientId,
      entityRef: `${patient.first_name} ${patient.last_name || ''} — ${patient.uhid}`,
      newValue: { data_deletion_requested: true, reason },
    });

    return {
      message: 'Data deletion request recorded. Patient data will be anonymised within 30 days as per DPDPA.',
      requested_at: patient.data_deletion_requested_at,
    };
  }

  // ── DPDPA: Anonymise patient (irreversible) ────────────────────────────────
  // Replaces all PII with anonymised values while preserving billing/audit records
  async anonymisePatient(patientId: string, tenantId: string, user: UserContext) {
    if (user.role !== 'owner') {
      throw new ForbiddenException('Only Owner can anonymise patient data');
    }

    const patient = await this.findOne(patientId, tenantId);
    const uhid    = patient.uhid; // preserve UHID for billing record linkage

    // Replace all PII with anonymised placeholders
    patient.first_name    = 'ANONYMISED';
    patient.last_name     = null;
    patient.mobile        = `ANON-${Date.now()}`;
    patient.email         = null;
    patient.dob           = null;
    patient.age           = null;
    patient.address       = null;
    patient.area          = null;
    patient.notes         = null;
    patient.ref_by        = null;
    patient.profile_photo_url = null;
    patient.is_active     = false;
    patient.consent_given = false;
    patient.updated_by    = user.id;

    await this.patientRepo.save(patient);

    await this.auditService.log({
      tenantId,
      userId:   user.id,
      userName: user.full_name,
      userRole: user.role,
      action:   AuditAction.DELETE,
      entity:   'Patient',
      entityId: patientId,
      entityRef: `ANONYMISED — ${uhid}`,
      newValue: { anonymised: true, reason: 'DPDPA Right to Erasure' },
    });

    return {
      message: 'Patient data has been anonymised. Billing records retained for legal compliance.',
      uhid,
    };
  }

  // ── DPDPA: Consent report ──────────────────────────────────────────────────
  async getConsentReport(tenantId: string) {
    const [total, consented, pending] = await Promise.all([
      this.patientRepo.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.patientRepo.count({ where: { tenant_id: tenantId, is_active: true, consent_given: true } }),
      this.patientRepo.count({ where: { tenant_id: tenantId, is_active: true, consent_given: false } }),
    ]);

    // Patients with pending deletion requests
    const deletionRequests = await this.patientRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.data_deletion_requested_at IS NOT NULL')
      .andWhere('p.is_active = true')
      .select(['p.id', 'p.uhid', 'p.first_name', 'p.last_name', 'p.data_deletion_requested_at', 'p.data_deletion_reason'])
      .getMany();

    return {
      total_patients:    total,
      consent_given:     consented,
      consent_pending:   pending,
      consent_rate_pct:  total > 0 ? Math.round((consented / total) * 100) : 0,
      deletion_requests: deletionRequests.length,
      pending_deletions: deletionRequests,
    };
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
      if (dto.vip_category) (patient as any).vip_category = dto.vip_category;
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

  // ══════════════════════════════════════════════════════════════
  // Enhanced VIP Registration with Payment & Agent Validation
  // ══════════════════════════════════════════════════════════════
  async vipRegisterEnhanced(dto: VipRegisterEnhancedDto, tenantId: string, ipAddress: string) {
    // 1. Validate agent token
    const agent = await this.salesAgentService.validateAgentToken(dto.agent_code, dto.access_token, tenantId);
    
    // 2. Check rate limit
    const canRegister = await this.salesAgentService.checkRateLimit(agent.id, tenantId);
    if (!canRegister) {
      throw new BadRequestException('Rate limit exceeded. Maximum 10 registrations per hour.');
    }

    // 3. Check if patient exists
    let patient = await this.patientRepo.findOne({
      where: { mobile: dto.mobile, tenant_id: tenantId },
    });

    const vipStart = dayjs().format('YYYY-MM-DD');
    const vipEnd = dayjs().add(1, 'year').format('YYYY-MM-DD');

    // 4. Create or update patient
    if (patient) {
      patient.is_vip = true;
      patient.vip_start_date = vipStart;
      patient.vip_end_date = vipEnd;
      patient.vip_registered_by = agent.agent_name;
      patient.vip_payment_method = dto.payment_method;
      patient.vip_payment_amount = dto.payment_amount as any;
      patient.vip_payment_date = new Date();
      patient.vip_upi_txn_id = dto.upi_txn_id;
      if (dto.first_name) patient.first_name = dto.first_name;
      if (dto.last_name) patient.last_name = dto.last_name;
      if (dto.email) patient.email = dto.email;
      if (dto.area) patient.area = dto.area;
      if (dto.address) patient.address = dto.address;
      (patient as any).vip_category = dto.vip_category;
    } else {
      const uhid = await this.generateUhid(tenantId);
      const { vip_category, payment_method, payment_amount, upi_txn_id, ...patientData } = dto;
      (patient as any) = this.patientRepo.create({
        ...patientData as any,
        uhid,
        tenant_id: tenantId,
        is_vip: true,
        vip_start_date: vipStart,
        vip_end_date: vipEnd,
        vip_registered_by: agent.agent_name,
        vip_payment_method: dto.payment_method,
        vip_payment_amount: dto.payment_amount as any,
        vip_payment_date: new Date(),
        vip_upi_txn_id: dto.upi_txn_id,
        category: 'general' as any,

      });
    }

    await this.patientRepo.save(patient);

    // 5. Create VIP registration record for tracking
    const vipReg = this.vipRegRepo.create({
      tenant_id: tenantId,
      patient_id: patient.id,
      agent_id: agent.id,
      vip_category: dto.vip_category,
      payment_method: dto.payment_method,
      payment_amount: dto.payment_amount,
      upi_txn_id: dto.upi_txn_id,
      ip_address: ipAddress,
    });
    await this.vipRegRepo.save(vipReg);

    // 6. Send WhatsApp notification
    try {
      await this.sendWhatsAppWelcome(patient, dto.vip_category, vipEnd);
    } catch (err) {
      console.error('WhatsApp notification failed:', err);
    }

    return patient;
  }

  private async sendWhatsAppWelcome(patient: any, vipCategory: string, vipEndDate: string) {
    const message = `🎉 Welcome to MediSyn VIP Club!

Dear ${patient.salutation || ''} ${patient.first_name} ${patient.last_name || ''},

Your VIP Pass has been activated!

UHID: ${patient.uhid}
Plan: ${vipCategory.toUpperCase()}
Valid Until: ${dayjs(vipEndDate).format('DD MMM YYYY')}

✨ Your Benefits:
✓ Priority Service - Skip the queue
✓ Exclusive Discounts on medicines
✓ Health Reminders via WhatsApp
✓ Loyalty Rewards

Thank you for choosing MediSyn!

📍 MediSyn Specialty Clinic, Taliparamba
📞 0490 234 5678`;

    const whatsappToken = process.env.WHATSAPP_TOKEN;
    const whatsappPhoneId = process.env.WHATSAPP_PHONE_ID;
    if (whatsappToken && whatsappPhoneId && patient.mobile) {
      const phone = patient.mobile.replace(/\D/g, '');
      const to = phone.startsWith('91') ? phone : `91${phone}`;
      await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: `91${patient.mobile}`,
          message: message,
        }),
      });
    }
  }

}