import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from '../database/entities/payment.entity';
import { Queue, QueueStatus } from '../queue/queue.entity';
import { User } from '../database/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    @InjectRepository(Queue)
    private queueRepo: Repository<Queue>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private auditService: AuditService,
  ) {}

  // ── Get bill summary for a queue entry ──────────────────────────────
  // Returns consultation fee + medicine bill total + any existing payment
  async getBillSummary(queueId: string, tenantId: string) {
    const queue = await this.queueRepo.findOne({
      where: { id: queueId, tenant_id: tenantId },
    });
    if (!queue) throw new NotFoundException('Queue entry not found');

    // Get doctor's consultation fee
    let consultationFee = 0;
    if (queue.doctor_id) {
      const doctor = await this.userRepo.findOne({
        where: { id: queue.doctor_id, tenant_id: tenantId },
      });
      consultationFee = Number((doctor as any)?.consultation_fee ?? 0);
    }

    // Get medicine bill from sale
    let medicineCost = 0;
    let saleId = null;
    if ((queue as any).sale_id) {
      // Fetch sale total via raw query to avoid circular deps
      const result = await this.paymentRepo.query(
        `SELECT total_amount FROM sales WHERE id = $1 AND tenant_id = $2`,
        [(queue as any).sale_id, tenantId]
      );
      medicineCost = Number(result[0]?.total_amount ?? 0);
      saleId = (queue as any).sale_id;
    }

    // Check existing payment
    const existing = await this.paymentRepo.findOne({
      where: { queue_id: queueId, tenant_id: tenantId },
    });

    return {
      queue_id:         queueId,
      queue_status:     queue.status,
      patient_id:       queue.patient_id,
      doctor_id:        queue.doctor_id,
      sale_id:          saleId,
      consultation_fee: consultationFee,
      medicine_cost:    medicineCost,
      discount:         0,
      total_amount:     consultationFee + medicineCost,
      payment:          existing ?? null,
      already_paid:     existing?.status === PaymentStatus.PAID,
    };
  }

  // ── Record payment ───────────────────────────────────────────────────
  async recordPayment(dto: {
    queue_id:         string;
    payment_method:   PaymentMethod;
    amount_paid:      number;
    discount?:        number;
    upi_ref?:         string;
    card_last4?:      string;
    notes?:           string;
    consultation_fee: number;
    medicine_cost:    number;
  }, actor: UserContext) {
    const { tenant_id: tenantId, id: userId } = actor;

    const queue = await this.queueRepo.findOne({
      where: { id: dto.queue_id, tenant_id: tenantId },
    });
    if (!queue) throw new NotFoundException('Queue entry not found');

    const existing = await this.paymentRepo.findOne({
      where: { queue_id: dto.queue_id, tenant_id: tenantId, status: PaymentStatus.PAID },
    });
    if (existing) throw new BadRequestException('Payment already recorded for this visit');

    const discount    = Number(dto.discount ?? 0);
    const totalAmount = Number(dto.consultation_fee) + Number(dto.medicine_cost) - discount;
    const amountPaid  = Number(dto.amount_paid);
    const change      = dto.payment_method === PaymentMethod.CASH
      ? Math.max(0, amountPaid - totalAmount)
      : 0;

    if (amountPaid < totalAmount && dto.payment_method !== PaymentMethod.CASH) {
      throw new BadRequestException('Amount paid is less than total amount');
    }

    // Generate receipt number
    const count = await this.paymentRepo.count({ where: { tenant_id: tenantId } });
    const receiptNo = `RCP-${String(count + 1).padStart(5, '0')}`;

    const payment = this.paymentRepo.create({
      tenant_id:        tenantId,
      queue_id:         dto.queue_id,
      patient_id:       queue.patient_id,
      consultation_fee: dto.consultation_fee,
      medicine_cost:    dto.medicine_cost,
      discount,
      total_amount:     totalAmount,
      amount_paid:      amountPaid,
      change_returned:  change,
      payment_method:   dto.payment_method,
      upi_ref:          dto.upi_ref ?? null,
      card_last4:       dto.card_last4 ?? null,
      status:           PaymentStatus.PAID,
      receipt_no:       receiptNo,
      notes:            dto.notes ?? null,
      collected_by:     userId,
    });
    const saved = await this.paymentRepo.save(payment);

    // Advance queue to COMPLETED
    queue.status = QueueStatus.COMPLETED;
    await this.queueRepo.save(queue);

    await this.auditService.log({
      tenantId,
      userId,
      userName: actor.full_name,
      userRole: actor.role,
      action:   AuditAction.CREATE,
      entity:   'Payment',
      entityId: saved.id,
      entityRef: `${receiptNo} — ₹${totalAmount.toFixed(2)} via ${dto.payment_method.toUpperCase()}`,
      newValue: { receipt_no: receiptNo, total: totalAmount, method: dto.payment_method },
    });

    return saved;
  }

  // ── Get payment by queue ─────────────────────────────────────────────
  async getByQueue(queueId: string, tenantId: string) {
    return this.paymentRepo.findOne({ where: { queue_id: queueId, tenant_id: tenantId } });
  }

  // ── List payments ─────────────────────────────────────────────────────
  async list(tenantId: string, filters: { date?: string; page?: number; limit?: number }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.paymentRepo.createQueryBuilder('p')
      .where('p.tenant_id = :tenantId', { tenantId })
      .orderBy('p.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filters.date) qb.andWhere('DATE(p.created_at) = :date', { date: filters.date });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }
}
