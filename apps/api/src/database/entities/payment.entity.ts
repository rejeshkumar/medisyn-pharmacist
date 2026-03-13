import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum PaymentMethod {
  CASH = 'cash',
  UPI  = 'upi',
  CARD = 'card',
}

export enum PaymentStatus {
  PENDING  = 'pending',
  PAID     = 'paid',
  PARTIAL  = 'partial',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  queue_id: string;

  @Column({ type: 'uuid', nullable: true })
  patient_id: string;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string;            // pharmacy bill

  @Column({ type: 'uuid', nullable: true })
  consultation_id: string;    // consultation record

  // ── Amounts ───────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  consultation_fee: number;   // from doctor's fee

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  medicine_cost: number;      // from pharmacy bill

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  total_amount: number;       // consultation_fee + medicine_cost - discount

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  change_returned: number;    // cash change

  // ── Payment details ───────────────────────────────────
  @Column({ type: 'varchar', default: PaymentMethod.CASH })
  payment_method: PaymentMethod;

  @Column({ type: 'varchar', nullable: true })
  upi_ref: string;            // UPI transaction ref

  @Column({ type: 'varchar', nullable: true })
  card_last4: string;         // last 4 digits

  @Column({ type: 'varchar', default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  receipt_no: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ── Audit ─────────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true })
  collected_by: string;       // user who recorded payment

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
