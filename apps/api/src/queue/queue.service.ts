import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Queue, QueueStatus } from './queue.entity';
import { PreCheck } from './pre-check.entity';
import { CreateQueueDto, UpdateQueueStatusDto, RecordPreCheckDto } from './queue.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
import { AuditAction } from '../database/entities/audit-log.entity';

@Injectable()
export class QueueService {
  constructor(
    @InjectRepository(Queue)
    private queueRepo: Repository<Queue>,
    @InjectRepository(PreCheck)
    private preCheckRepo: Repository<PreCheck>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  // ── Get next token number for today ──────────────────────────────
  private async getNextToken(tenantId: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const result = await this.queueRepo
      .createQueryBuilder('q')
      .select('MAX(q.token_number)', 'max')
      .where('q.tenant_id = :tenantId', { tenantId })
      .andWhere('q.visit_date = :today', { today })
      .getRawOne();
    return (result?.max ?? 0) + 1;
  }

  // ── Register patient in queue ─────────────────────────────────────
  async register(
    dto: CreateQueueDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Queue> {
    const token = await this.getNextToken(tenantId);
    const today = new Date().toISOString().split('T')[0];

    // Determine initial status
    let initialStatus = QueueStatus.WAITING;
    if (dto.is_emergency) initialStatus = QueueStatus.EMERGENCY;
    else if (dto.skip_precheck) initialStatus = QueueStatus.PRECHECK_DONE;

    const queue = this.queueRepo.create({
      tenant_id: tenantId,
      patient_id: dto.patient_id,
      doctor_id: dto.doctor_id ?? null,
      token_number: token,
      visit_date: today,
      visit_type: dto.is_emergency ? 'emergency' as any : (dto.visit_type ?? 'new' as any),
      chief_complaint: dto.chief_complaint,
      notes: dto.notes,
      status: initialStatus,
      is_emergency: dto.is_emergency ?? false,
      skip_precheck: dto.skip_precheck ?? false,
      skip_reason: dto.skip_reason ?? null,
      consultation_fee: dto.consultation_fee ?? 0,
      created_by: user.id,
      updated_by: user.id,
    });

    const saved = await this.queueRepo.save(queue);

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.CREATE,
      entity: 'queues',
      entityId: saved.id,
      newValue: {
        patient_id: dto.patient_id, token,
        visit_type: dto.visit_type,
        is_emergency: dto.is_emergency,
        skip_precheck: dto.skip_precheck,
      },
    });

    return saved;
  }

  // ── Get today's queue ─────────────────────────────────────────────
  async getTodayQueue(tenantId: string, doctorId?: string): Promise<Queue[]> {
    const today = new Date().toISOString().split('T')[0];
    const qb = this.queueRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.patient', 'patient')
      .leftJoinAndSelect('q.doctor', 'doctor')
      .where('q.tenant_id = :tenantId', { tenantId })
      .andWhere('q.visit_date = :today', { today })
      .andWhere('q.is_active = true')
      // Emergency first, then by token
      .orderBy('q.is_emergency', 'DESC')
      .addOrderBy('q.token_number', 'ASC');

    if (doctorId) {
      qb.andWhere('q.doctor_id = :doctorId', { doctorId });
    }

    return qb.getMany();
  }

  // ── Get single queue entry ────────────────────────────────────────
  async getById(id: string, tenantId: string): Promise<Queue> {
    const queue = await this.queueRepo
      .createQueryBuilder('q')
      .leftJoinAndSelect('q.patient', 'patient')
      .leftJoinAndSelect('q.doctor', 'doctor')
      .where('q.id = :id', { id })
      .andWhere('q.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!queue) throw new NotFoundException('Queue entry not found');
    return queue;
  }

  // ── Update queue status (no restriction — any role can move to any status) ──
  async updateStatus(
    id: string,
    dto: UpdateQueueStatusDto,
    tenantId: string,
    user: UserContext,
  ): Promise<Queue> {
    const queue = await this.getById(id, tenantId);
    const oldStatus = queue.status;

    queue.status = dto.status as QueueStatus;
    queue.updated_by = user.id;

    if (dto.doctor_id) queue.doctor_id = dto.doctor_id;
    if (dto.status === QueueStatus.IN_CONSULTATION) queue.called_at = new Date();
    if ([QueueStatus.COMPLETED, QueueStatus.CANCELLED, QueueStatus.NO_SHOW]
        .includes(dto.status as QueueStatus)) {
      queue.completed_at = new Date();
    }

    const saved = await this.queueRepo.save(queue);

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: AuditAction.UPDATE,
      entity: 'queues',
      entityId: id,
      oldValue: { status: oldStatus },
      newValue: { status: dto.status, override_reason: dto.override_reason },
    });

    return saved;
  }

  // ── Doctor pulls patient directly (skip precheck) ─────────────────
  async pullToConsultation(
    id: string,
    tenantId: string,
    user: UserContext,
  ): Promise<Queue> {
    return this.updateStatus(
      id,
      { status: QueueStatus.IN_CONSULTATION, doctor_id: user.id, override_reason: 'Doctor pulled from queue' },
      tenantId,
      user,
    );
  }

  // ── Get today's stats ─────────────────────────────────────────────
  async getTodayStats(tenantId: string): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const rows = await this.queueRepo
      .createQueryBuilder('q')
      .select('q.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('q.tenant_id = :tenantId', { tenantId })
      .andWhere('q.visit_date = :today', { today })
      .andWhere('q.is_active = true')
      .groupBy('q.status')
      .getRawMany();

    const stats: any = {
      total: 0, waiting: 0, in_precheck: 0, precheck_done: 0,
      in_consultation: 0, consultation_done: 0, completed: 0, cancelled: 0,
      emergency: 0,
    };
    rows.forEach(r => {
      stats[r.status] = parseInt(r.count);
      stats.total += parseInt(r.count);
    });
    return stats;
  }

  // ── Record pre-check vitals ───────────────────────────────────────
  async recordPreCheck(
    dto: RecordPreCheckDto,
    tenantId: string,
    user: UserContext,
  ): Promise<PreCheck> {
    const queue = await this.getById(dto.queue_id, tenantId);

    let bmi: number | null = null;
    if (dto.weight && dto.height) {
      const heightM = dto.height / 100;
      bmi = parseFloat((dto.weight / (heightM * heightM)).toFixed(1));
    }

    const vitalsData = {
      bp_systolic: dto.bp_systolic,
      bp_diastolic: dto.bp_diastolic,
      pulse_rate: dto.pulse_rate,
      temperature: dto.temperature,
      weight: dto.weight,
      height: dto.height,
      bmi,
      spo2: dto.spo2,
      blood_sugar: dto.blood_sugar,
      chief_complaint: dto.chief_complaint,
      allergies: dto.allergies,
      current_medicines: dto.current_medicines,
      notes: dto.notes,
      updated_by: user.id,
    };

    let preCheck = await this.preCheckRepo.findOne({
      where: { queue_id: dto.queue_id, tenant_id: tenantId },
    });

    if (preCheck) {
      Object.assign(preCheck, vitalsData);
    } else {
      preCheck = this.preCheckRepo.create({
        tenant_id: tenantId,
        queue_id: dto.queue_id,
        patient_id: queue.patient_id,
        recorded_by: user.id,
        created_by: user.id,
        ...vitalsData,
      });
    }

    const saved = await this.preCheckRepo.save(preCheck);

    const earlyStatuses: QueueStatus[] = [QueueStatus.WAITING, QueueStatus.IN_PRECHECK];
    if (earlyStatuses.includes(queue.status as QueueStatus)) {
      await this.updateStatus(
        dto.queue_id,
        { status: QueueStatus.PRECHECK_DONE },
        tenantId,
        user,
      );
    }

    await this.auditService.log({
      tenantId,
      userId: user.id,
      userName: user.full_name,
      userRole: user.role,
      action: preCheck.created_at ? AuditAction.UPDATE : AuditAction.CREATE,
      entity: 'pre_checks',
      entityId: saved.id,
      newValue: { queue_id: dto.queue_id, patient_id: queue.patient_id },
    });

    return saved;
  }

  // ── Get pre-check by queue ────────────────────────────────────────
  async getPreCheckByQueue(queueId: string, tenantId: string): Promise<PreCheck> {
    const preCheck = await this.preCheckRepo
      .createQueryBuilder('pc')
      .leftJoinAndSelect('pc.recorder', 'recorder')
      .where('pc.queue_id = :queueId', { queueId })
      .andWhere('pc.tenant_id = :tenantId', { tenantId })
      .getOne();

    if (!preCheck) throw new NotFoundException('Pre-check not found for this queue entry');
    return preCheck;
  }
}
