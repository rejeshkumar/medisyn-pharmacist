import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { ServiceCategory } from './service-rate.entity';

export enum BillStatus {
  DRAFT     = 'draft',
  CONFIRMED = 'confirmed',
  PAID      = 'paid',
  VOID      = 'void',
}

export enum BillPaymentMode {
  CASH   = 'cash',
  UPI    = 'upi',
  CARD   = 'card',
  CREDIT = 'credit',
}

export enum BillLineSource {
  MANUAL       = 'manual',
  PHARMACY     = 'pharmacy',
  LAB          = 'lab',
  CONSULTATION = 'consultation',
}

@Entity('clinic_bills')
export class ClinicBill {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;

  @Column({ type: 'varchar', length: 30 }) bill_number: string;

  @Column({ type: 'uuid' }) patient_id: string;

  @Column({ type: 'uuid', nullable: true }) queue_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) gst_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) vip_discount_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) extra_discount_amt: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) extra_discount_pct: number;

  @Column({ type: 'varchar', length: 200, nullable: true }) extra_discount_note: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) total_amount: number;

  @Column({ type: 'enum', enum: BillPaymentMode, default: BillPaymentMode.CASH })
  payment_mode: BillPaymentMode;

  @Column({ type: 'enum', enum: BillStatus, default: BillStatus.DRAFT })
  status: BillStatus;

  @Column({ type: 'text', nullable: true }) notes: string;

  @Column({ type: 'uuid', nullable: true }) created_by: string;

  @OneToMany(() => ClinicBillItem, item => item.bill_id, { cascade: true, eager: true })
  items: ClinicBillItem[];

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}

@Entity('clinic_bill_items')
export class ClinicBillItem {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;

  @Column({ type: 'uuid' }) bill_id: string;

  @Column({ type: 'enum', enum: ServiceCategory }) category: ServiceCategory;

  @Column({ type: 'varchar', length: 200 }) name: string;

  @Column({ type: 'int', default: 1 }) qty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 }) unit_rate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) gst_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 }) line_total: number;

  @Column({ type: 'enum', enum: BillLineSource, default: BillLineSource.MANUAL })
  source: BillLineSource;

  @Column({ type: 'uuid', nullable: true }) source_id: string;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
}
