import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, OneToMany, Index,
} from 'typeorm';
import { User } from './user.entity';
import { PatientAppointment } from './patient-appointment.entity';
import { PatientReminder } from './patient-reminder.entity';

export enum Salutation { MR = 'Mr', MRS = 'Mrs', MS = 'Ms', DR = 'Dr', BABY = 'Baby', OTHER = 'Other' }
export enum Gender { MALE = 'male', FEMALE = 'female', OTHER = 'other' }
export enum PatientCategory { GENERAL = 'general', INSURANCE = 'insurance', CORPORATE = 'corporate', SENIOR = 'senior' }

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  uhid: string;

  @Column({ type: 'enum', enum: Salutation, default: Salutation.MR })
  salutation: Salutation;

  @Column()
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ type: 'enum', enum: Gender, default: Gender.MALE })
  gender: Gender;

  @Column({ type: 'date', nullable: true })
  dob: string;

  @Column({ type: 'int', nullable: true })
  age: number;

  @Index()
  @Column()
  mobile: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  area: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'enum', enum: PatientCategory, default: PatientCategory.GENERAL })
  category: PatientCategory;

  @Column({ nullable: true })
  ref_by: string;

  @Column({ nullable: true })
  residence_number: string;

  @Column({ nullable: true })
  profile_photo_url: string;

  @Column({ default: true })
  is_first_visit: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // ── VIP Pass ───────────────────────────────────────────────────────────────
  @Column({ default: false })
  is_vip: boolean;

  @Column({ type: 'date', nullable: true })
  vip_start_date: string;

  @Column({ type: 'date', nullable: true })
  vip_end_date: string;

  @Column({ nullable: true })
  vip_registered_by: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ nullable: true })
  created_by: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => PatientAppointment, (a) => a.patient)
  appointments: PatientAppointment[];

  @OneToMany(() => PatientReminder, (r) => r.patient)
  reminders: PatientReminder[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
