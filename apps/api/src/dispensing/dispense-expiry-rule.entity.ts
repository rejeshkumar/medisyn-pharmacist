import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';

export enum DrugCategory {
  ACUTE = 'ACUTE',
  CHRONIC = 'CHRONIC',
  HIGH_RISK = 'HIGH_RISK',
}

@Entity('dispense_expiry_rules')
export class DispenseExpiryRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'enum', enum: DrugCategory })
  category: DrugCategory;

  @Column({ type: 'int', default: 15 })
  hard_stop_days: number;

  @Column({ type: 'int', default: 30 })
  warning_days: number;

  @Column({ type: 'int', default: 5 })
  safety_buffer_days: number;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
