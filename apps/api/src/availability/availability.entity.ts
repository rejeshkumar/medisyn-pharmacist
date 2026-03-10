import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

@Entity('doctor_availability')
export class DoctorAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'int' })
  day_of_week: number; // 0=Sun, 1=Mon ... 6=Sat

  @Column({ type: 'time' })
  start_time: string; // 'HH:MM'

  @Column({ type: 'time' })
  end_time: string;

  @Column({ type: 'int', default: 10 })
  slot_duration_mins: number;

  @Column({ type: 'int', default: 1 })
  max_patients_per_slot: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

@Entity('doctor_leaves')
export class DoctorLeave {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  doctor_id: string;

  @Column({ type: 'date' })
  leave_date: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @CreateDateColumn()
  created_at: Date;
}
