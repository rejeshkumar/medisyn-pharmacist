import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

export enum DispenseValidationStatus {
  ALLOW = 'ALLOW',
  WARN = 'WARN',
  BLOCK = 'BLOCK',
}

@Entity('dispense_audit_log')
export class DispenseAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string;

  @Column({ type: 'uuid' })
  medicine_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  medicine_name: string;

  @Column({ type: 'uuid' })
  batch_id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batch_number: string;

  @Column({ type: 'date' })
  expiry_date: Date;

  @Column({ type: 'int' })
  days_to_expiry: number;

  @Column({ type: 'enum', enum: DispenseValidationStatus })
  validation_status: DispenseValidationStatus;

  @Column({ type: 'text', nullable: true })
  validation_message: string;

  @Column({ default: false })
  override_flag: boolean;

  @Column({ type: 'text', nullable: true })
  override_reason: string;

  @Column({ type: 'int', nullable: true })
  course_days: number;

  @Column({ type: 'int', nullable: true })
  qty_dispensed: number;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_name: string;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  dispensed_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
