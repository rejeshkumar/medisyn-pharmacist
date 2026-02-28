import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum ReminderType {
  APPOINTMENT = 'appointment',
  MEDICATION = 'medication',
  FOLLOW_UP = 'follow_up',
  VIP_RENEWAL = 'vip_renewal',
  GENERAL = 'general',
}

@Entity('patient_reminders')
export class PatientReminder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  patient_id: string;

  @ManyToOne(() => Patient, (p) => p.reminders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ nullable: true })
  appointment_id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'timestamp' })
  remind_at: Date;

  @Column({ type: 'enum', enum: ReminderType, default: ReminderType.GENERAL })
  type: ReminderType;

  @Column({ default: false })
  is_done: boolean;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn()
  created_at: Date;
}
