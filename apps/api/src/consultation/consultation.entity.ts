import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToOne,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
import { Queue } from '../queue/queue.entity';

@Entity('consultations')
export class Consultation {
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
  doctor_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ type: 'text', nullable: true })
  symptoms: string;

  @Column({ type: 'text', nullable: true })
  examination: string;

  @Column({ type: 'text' })
  diagnosis: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  diagnosis_code: string;

  @Column({ type: 'text', nullable: true })
  advice: string;

  @Column({ type: 'date', nullable: true })
  follow_up_date: string;

  @Column({ type: 'text', nullable: true })
  referral: string;

  @Column({ default: false })
  is_follow_up: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date;

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
