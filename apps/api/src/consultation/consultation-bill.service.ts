import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConsultationBill, PaymentStatus } from './consultation-bill.entity';
import { UserContext } from '../sales/sales.service';

@Injectable()
export class ConsultationBillService {
  constructor(
    @InjectRepository(ConsultationBill)
    private billRepo: Repository<ConsultationBill>,
  ) {}

  // ── Generate bill number ──────────────────────────────────────────
  private async generateBillNo(tenantId: string): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.billRepo
      .createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(b.created_at) = CURRENT_DATE')
      .getCount();
    return `CB-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }

  // ── Create consultation bill (called when consultation completes) ──
  async create(data: {
    tenantId: string;
    queueId: string;
    consultationId?: string;
    patientId: string;
    doctorId: string;
    consultationFee: number;
    visitType: string;
    items?: Array<{ label: string; amount: number }>;
    user: UserContext;
  }): Promise<ConsultationBill> {
    const billNo = await this.generateBillNo(data.tenantId);

    const items = data.items ?? [
      { label: data.visitType === 'follow_up' ? 'Follow-up Consultation' : 'Consultation', amount: data.consultationFee },
    ];

    const procedureCharges = items
      .filter(i => !i.label.toLowerCase().includes('consultation'))
      .reduce((sum, i) => sum + i.amount, 0);

    const total = items.reduce((sum, i) => sum + i.amount, 0);

    const bill = this.billRepo.create({
      tenant_id: data.tenantId,
      queue_id: data.queueId,
      consultation_id: data.consultationId ?? null,
      patient_id: data.patientId,
      doctor_id: data.doctorId,
      bill_number: billNo,
      items,
      consultation_fee: data.consultationFee,
      procedure_charges: procedureCharges,
      discount_amount: 0,
      total_amount: total,
      amount_paid: 0,
      balance_due: total,
      payment_status: PaymentStatus.PENDING,
      created_by: data.user.id,
    });

    return this.billRepo.save(bill);
  }

  // ── Collect payment ───────────────────────────────────────────────
  async collectPayment(
    id: string,
    tenantId: string,
    data: {
      amount_paid: number;
      payment_mode: string;
      discount_amount?: number;
      notes?: string;
    },
    user: UserContext,
  ): Promise<ConsultationBill> {
    const bill = await this.getById(id, tenantId);

    const discount = data.discount_amount ?? bill.discount_amount;
    const effective_total = Number(bill.total_amount) - discount;
    const balance = effective_total - data.amount_paid;

    bill.amount_paid = data.amount_paid;
    bill.discount_amount = discount;
    bill.balance_due = Math.max(0, balance);
    bill.payment_mode = data.payment_mode;
    bill.notes = data.notes ?? bill.notes;
    bill.payment_status = balance <= 0 ? PaymentStatus.PAID :
                          data.amount_paid > 0 ? PaymentStatus.PARTIAL :
                          PaymentStatus.PENDING;
    if (bill.payment_status === PaymentStatus.PAID) bill.paid_at = new Date();

    return this.billRepo.save(bill);
  }

  // ── Waive fee ─────────────────────────────────────────────────────
  async waive(id: string, tenantId: string, reason: string, user: UserContext): Promise<ConsultationBill> {
    const bill = await this.getById(id, tenantId);
    bill.payment_status = PaymentStatus.WAIVED;
    bill.discount_amount = bill.total_amount;
    bill.balance_due = 0;
    bill.notes = reason;
    bill.paid_at = new Date();
    return this.billRepo.save(bill);
  }

  // ── Get by ID ─────────────────────────────────────────────────────
  async getById(id: string, tenantId: string): Promise<ConsultationBill> {
    const bill = await this.billRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.patient', 'patient')
      .leftJoinAndSelect('b.doctor', 'doctor')
      .leftJoinAndSelect('b.queue', 'queue')
      .where('b.id = :id', { id })
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .getOne();
    if (!bill) throw new NotFoundException('Consultation bill not found');
    return bill;
  }

  // ── Get by queue ID ───────────────────────────────────────────────
  async getByQueue(queueId: string, tenantId: string): Promise<ConsultationBill | null> {
    return this.billRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.patient', 'patient')
      .leftJoinAndSelect('b.doctor', 'doctor')
      .where('b.queue_id = :queueId', { queueId })
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .getOne();
  }

  // ── Get today's pending bills (for receptionist) ──────────────────
  async getPendingToday(tenantId: string): Promise<ConsultationBill[]> {
    return this.billRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.patient', 'patient')
      .leftJoinAndSelect('b.doctor', 'doctor')
      .leftJoinAndSelect('b.queue', 'queue')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(b.created_at) = CURRENT_DATE')
      .andWhere('b.payment_status IN (:...statuses)', { statuses: ['pending', 'partial'] })
      .orderBy('b.created_at', 'ASC')
      .getMany();
  }

  // ── Get today's all bills (for receptionist + owner) ─────────────
  async getTodayAll(tenantId: string): Promise<ConsultationBill[]> {
    return this.billRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.patient', 'patient')
      .leftJoinAndSelect('b.doctor', 'doctor')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('DATE(b.created_at) = CURRENT_DATE')
      .orderBy('b.created_at', 'DESC')
      .getMany();
  }

  // ── Summary for dashboard ─────────────────────────────────────────
  async getTodaySummary(tenantId: string): Promise<any> {
    const bills = await this.getTodayAll(tenantId);
    return {
      total_bills: bills.length,
      total_amount: bills.reduce((s, b) => s + Number(b.total_amount), 0),
      collected: bills.reduce((s, b) => s + Number(b.amount_paid), 0),
      pending_count: bills.filter(b => ['pending', 'partial'].includes(b.payment_status)).length,
      pending_amount: bills.filter(b => ['pending', 'partial'].includes(b.payment_status))
                          .reduce((s, b) => s + Number(b.balance_due), 0),
    };
  }
}
