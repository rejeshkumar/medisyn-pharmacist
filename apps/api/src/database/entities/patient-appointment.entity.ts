import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum AppointmentType {
  CONSULTATION = 'consultation',
  FOLLOW_UP = 'follow_up',
  PHARMACY_VISIT = 'pharmacy_visit',
  VACCINATION = 'vaccination',
  REVIEW = 'review',
}

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
}

@Entity('patient_appointments')
export class PatientAppointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  patient_id: string;

  @ManyToOne(() => Patient, (p) => p.appointments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Index()
  @Column({ type: 'date' })
  appointment_date: string;

  @Column({ nullable: true })
  appointment_time: string;

  @Column({ type: 'enum', enum: AppointmentType, default: AppointmentType.CONSULTATION })
  type: AppointmentType;

  @Column({ type: 'enum', enum: AppointmentStatus, default: AppointmentStatus.SCHEDULED })
  status: AppointmentStatus;

  @Column({ nullable: true })
  doctor_name: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ nullable: true })
  cancellation_reason: string;

  @Column({ default: false })
  reminder_sent: boolean;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
