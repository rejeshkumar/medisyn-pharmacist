import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum ServiceCategory {
  CONSULTATION = 'consultation',
  PHARMACY     = 'pharmacy',
  LAB          = 'lab',
  PROCEDURE    = 'procedure',
  OTHER        = 'other',
}

@Entity('service_rates')
export class ServiceRate {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;

  @Column({ type: 'enum', enum: ServiceCategory }) category: ServiceCategory;

  @Column({ type: 'varchar', length: 200 }) name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 }) rate: number;

  @Column({ type: 'varchar', length: 50, default: 'per visit' }) unit: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 }) gst_percent: number;

  @Column({ default: true }) is_active: boolean;

  @Column({ type: 'int', default: 0 }) sort_order: number;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
