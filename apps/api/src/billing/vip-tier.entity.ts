import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum VipTier {
  INDIVIDUAL       = 'individual',
  FAMILY           = 'family',
  EXTENDED_FAMILY  = 'extended_family',
}

@Entity('vip_tiers')
export class VipTierConfig {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;

  @Column({ type: 'enum', enum: VipTier }) tier: VipTier;

  @Column({ type: 'varchar', length: 60 }) label: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  annual_fee: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  doctor_discount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  pharmacy_discount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  lab_discount: number;

  @Column({ default: true }) is_active: boolean;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
