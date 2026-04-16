import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
import { Queue } from '../queue/queue.entity';
import { Consultation } from './consultation.entity';

export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PARTIAL = 'partial',
  WAIVED = 'waived',
}

@Entity('consultation_bills')
export class ConsultationBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  queue_id: string;

  @ManyToOne(() => Queue)
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @Column({ type: 'uuid', nullable: true })
  consultation_id: string;

  @ManyToOne(() => Consultation, { nullable: true })
  @JoinColumn({ name: 'consultation_id' })
  consultation: Consultation;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ type: 'varchar', unique: true })
  bill_number: string;

  // items: [{ label: 'Consultation', amount: 200 }, { label: 'Dressing', amount: 50 }]
  @Column({ type: 'jsonb', default: '[]' })
  items: Array<{ label: string; amount: number }>;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  consultation_fee: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  procedure_charges: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  balance_due: number;

  @Column({ type: 'varchar', length: 20, nullable: true })
  payment_mode: string;

  @Column({ type: 'varchar', length: 20, default: PaymentStatus.PENDING })
  payment_status: string;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
