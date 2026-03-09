import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
import { Consultation } from './consultation.entity';
import { PrescriptionItem } from './prescription-item.entity';

export enum PrescriptionStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PARTIALLY_DISPENSED = 'partially_dispensed',
  FULLY_DISPENSED = 'fully_dispensed',
  CANCELLED = 'cancelled',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  consultation_id: string;

  @ManyToOne(() => Consultation)
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

  @Column({ type: 'varchar', length: 30 })
  prescription_no: string;

  @Column({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.ISSUED })
  status: PrescriptionStatus;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  issued_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dispensed_at: Date;

  @OneToMany(() => PrescriptionItem, item => item.prescription, { cascade: true, eager: true })
  items: PrescriptionItem[];

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
