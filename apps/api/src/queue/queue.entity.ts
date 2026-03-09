import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';

export enum QueueStatus {
  WAITING = 'waiting',
  IN_PRECHECK = 'in_precheck',
  PRECHECK_DONE = 'precheck_done',
  IN_CONSULTATION = 'in_consultation',
  CONSULTATION_DONE = 'consultation_done',
  DISPENSING = 'dispensing',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum ConsultationType {
  NEW = 'new',
  FOLLOW_UP = 'follow_up',
  EMERGENCY = 'emergency',
}

@Entity('queues')
export class Queue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  doctor_id: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ type: 'int' })
  token_number: number;

  @Column({ type: 'date', default: () => 'CURRENT_DATE' })
  visit_date: string;

  @Column({ type: 'enum', enum: QueueStatus, default: QueueStatus.WAITING })
  status: QueueStatus;

  @Column({ type: 'enum', enum: ConsultationType, default: ConsultationType.NEW })
  visit_type: ConsultationType;

  @Column({ type: 'text', nullable: true })
  chief_complaint: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  registered_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  called_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date;

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
