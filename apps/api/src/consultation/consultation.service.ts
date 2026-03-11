import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Consultation } from './consultation.entity';
import { Prescription, PrescriptionStatus } from './prescription.entity';
import { PrescriptionItem } from './prescription-item.entity';
import { CreateConsultationDto, UpdateConsultationDto, CreatePrescriptionDto } from './consultation.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';
import { QueueService } from '../queue/queue.service';
import { QueueStatus } from '../queue/queue.entity';

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(Consultation)
    private consultationRepo: Repository<Consultation>,
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepo: Repository<PrescriptionItem>,
    private auditService: AuditService,
    private queueService: QueueService,
  ) {}

  // ── Generate prescription number ──────────────────────────────────
  private async generatePrescriptionNo(tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prescriptionRepo
      .createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(p.issued_at) = CURRENT_DATE')
      .getCount();
    const seq = String(count + 1).padStart(3, '0');
    return `RX-${dateStr}-${seq}`;
  }

  // ── Start consultation ────────────────────────────────────────────
  async startConsultation(
    dto: CreateConsultationDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Consultation> {
    const consultation = this.consultationRepo.create({
      tenant_id: tenantId,
      queue_id: dto.queue_id,
      patient_id: dto.patient_id,
      doctor_id: user.id,
      symptoms: dto.symptoms,
      examination: dto.examination,
      diagnosis: dto.diagnosis,
      diagnosis_code: dto.diagnosis_code,
      advice: dto.advice,
      follow_up_date: dto.follow_up_date,
      referral: dto.referral,
      is_follow_up: dto.is_follow_up ?? false,
      started_at: new Date(),
      created_by: user.id,
      updated_by: user.id,
    });

    const saved = await this.consultationRepo.save(consultation);

    // Advance queue to in_consultation
    await this.queueService.updateStatus(
      dto.queue_id,
      { status: QueueStatus.IN_CONSULTATION, doctor_id: user.id },
      tenantId,
      user,
    );

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.CREATE,
      entity: 'consultations',
      entityId: saved.id,
      newValue: { patient_id: dto.patient_id, queue_id: dto.queue_id },
    });

    return saved;
  }

  // ── Update consultation notes (in-progress, no status change) ───────
  async updateConsultation(
    id: string,
    dto: UpdateConsultationDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Consultation> {
    const consultation = await this.getById(id, tenantId);

    Object.assign(consultation, { ...dto, updated_by: user.id });
    const saved = await this.consultationRepo.save(consultation);

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.UPDATE,
      entity: 'consultations',
      entityId: id,
      newValue: dto as Record<string, any>,
    });

    return saved;
  }

  // ── Complete consultation ─────────────────────────────────────────
  async completeConsultation(
    id: string,
    dto: UpdateConsultationDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Consultation> {
    const consultation = await this.getById(id, tenantId);

    Object.assign(consultation, {
      ...dto,
      completed_at: new Date(),
      updated_by: user.id,
    });

    const saved = await this.consultationRepo.save(consultation);

    // Advance queue to consultation_done
    await this.queueService.updateStatus(
      consultation.queue_id,
      { status: QueueStatus.CONSULTATION_DONE },
      tenantId,
      user,
    );

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.UPDATE,
      entity: 'consultations',
      entityId: id,
      newValue: { completed_at: saved.completed_at },
    });

    return saved;
  }

  // ── Get consultation by ID ────────────────────────────────────────
  async getById(id: string, tenantId: string): Promise<Consultation> {
    const consultation = await this.consultationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .leftJoinAndSelect('c.queue', 'queue')
      .where('c.id = :id', { id })
      .andWhere('c.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!consultation) throw new NotFoundException('Consultation not found');
    return consultation;
  }

  // ── Get consultation by queue ─────────────────────────────────────
  async getByQueue(queueId: string, tenantId: string): Promise<Consultation> {
    const consultation = await this.consultationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.patient', 'patient')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .where('c.queue_id = :queueId', { queueId })
      .andWhere('c.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!consultation) throw new NotFoundException('Consultation not found for this queue');
    return consultation;
  }

  // ── Get consultations for a patient ──────────────────────────────
  async getByPatient(patientId: string, tenantId: string): Promise<Consultation[]> {
    return this.consultationRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.doctor', 'doctor')
      .where('c.patient_id = :patientId', { patientId })
      .andWhere('c.tenant_id = :tenantId', { tenantId })
      .andWhere('c.is_active = true')
      .orderBy('c.created_at', 'DESC')
      .getMany();
  }

  // ── Create prescription ───────────────────────────────────────────
  async createPrescription(
    dto: CreatePrescriptionDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Prescription> {
    const consultation = await this.getById(dto.consultation_id, tenantId);
    const prescriptionNo = await this.generatePrescriptionNo(tenantId);

    const prescription = this.prescriptionRepo.create({
      tenant_id: tenantId,
      consultation_id: dto.consultation_id,
      patient_id: dto.patient_id,
      doctor_id: user.id,
      prescription_no: prescriptionNo,
      status: PrescriptionStatus.ISSUED,
      notes: dto.notes,
      issued_at: new Date(),
      created_by: user.id,
      updated_by: user.id,
      items: dto.items.map(item => this.prescriptionItemRepo.create({
        tenant_id: tenantId,
        medicine_id: item.medicine_id ?? null,
        medicine_name: item.medicine_name,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions,
        created_by: user.id,
        updated_by: user.id,
      })),
    });

    const saved = await this.prescriptionRepo.save(prescription);

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.CREATE,
      entity: 'prescriptions',
      entityId: saved.id,
      newValue: {
        prescription_no: prescriptionNo,
        patient_id: dto.patient_id,
        items_count: dto.items.length,
      },
    });

    return saved;
  }

  // ── Get prescription by ID ────────────────────────────────────────
  async getPrescriptionById(id: string, tenantId: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('items.medicine', 'medicine')
      .where('p.id = :id', { id })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!prescription) throw new NotFoundException('Prescription not found');
    return prescription;
  }

  // ── Get prescriptions by patient ─────────────────────────────────
  async getPrescriptionsByPatient(patientId: string, tenantId: string): Promise<Prescription[]> {
    return this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.items', 'items')
      .where('p.patient_id = :patientId', { patientId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.is_active = true')
      .orderBy('p.issued_at', 'DESC')
      .getMany();
  }

  // ── Get prescription by consultation ─────────────────────────────
  async getPrescriptionByConsultation(consultationId: string, tenantId: string): Promise<Prescription> {
    const prescription = await this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.patient', 'patient')
      .leftJoinAndSelect('p.doctor', 'doctor')
      .leftJoinAndSelect('p.items', 'items')
      .leftJoinAndSelect('items.medicine', 'medicine')
      .where('p.consultation_id = :consultationId', { consultationId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!prescription) throw new NotFoundException('Prescription not found for this consultation');
    return prescription;
  }

  // ── Mark prescription as dispensed ───────────────────────────────
  async markDispensed(
    id: string,
    saleId: string,
    tenantId: string,
    user: UserContext,
  ): Promise<Prescription> {
    const prescription = await this.getPrescriptionById(id, tenantId);

    prescription.status = PrescriptionStatus.FULLY_DISPENSED;
    prescription.sale_id = saleId;
    prescription.dispensed_at = new Date();
    prescription.updated_by = user.id;

    const saved = await this.prescriptionRepo.save(prescription);

    // Advance the queue to completed now that medicine has been dispensed
    if (prescription.consultation_id) {
      const consultation = await this.consultationRepo.findOne({
        where: { id: prescription.consultation_id, tenant_id: tenantId },
      });
      if (consultation?.queue_id) {
        try {
          await this.queueService.updateStatus(
            consultation.queue_id,
            { status: QueueStatus.COMPLETED },
            tenantId,
            user,
          );
        } catch {
          // Non-fatal — prescription is already marked dispensed
        }
      }
    }

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.DISPENSE,
      entity: 'prescriptions',
      entityId: id,
      newValue: { status: PrescriptionStatus.FULLY_DISPENSED, sale_id: saleId },
    });

    return saved;
  }
}
