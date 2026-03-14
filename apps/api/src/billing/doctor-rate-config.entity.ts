import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

@Entity('doctor_rate_configs')
export class DoctorRateConfig {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;

  @Column({ type: 'uuid' }) doctor_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 300 })
  new_visit_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 150 })
  follow_up_rate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 500 })
  emergency_rate: number;

  @Column({ default: true })
  vip_discount_applicable: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
