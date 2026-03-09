import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToOne,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
import { Queue } from './queue.entity';

@Entity('pre_checks')
export class PreCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  queue_id: string;

  @OneToOne(() => Queue)
  @JoinColumn({ name: 'queue_id' })
  queue: Queue;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid' })
  recorded_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by' })
  recorder: User;

  @Column({ type: 'int', nullable: true })
  bp_systolic: number;

  @Column({ type: 'int', nullable: true })
  bp_diastolic: number;

  @Column({ type: 'int', nullable: true })
  pulse_rate: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  height: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  bmi: number;

  @Column({ type: 'int', nullable: true })
  spo2: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  blood_sugar: number;

  @Column({ type: 'text', nullable: true })
  chief_complaint: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ type: 'text', nullable: true })
  current_medicines: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  recorded_at: Date;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
