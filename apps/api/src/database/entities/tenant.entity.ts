import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum TenantMode {
  PHARMACY = 'pharmacy',
  CLINIC   = 'clinic',
  FULL     = 'full',
}

export enum TenantPlan {
  TRIAL = 'trial',
  BASIC = 'basic',
  PRO   = 'pro',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 200 })
  name: string;

  @Column({ length: 100, unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20, default: TenantMode.FULL })
  mode: TenantMode;

  @Column({ type: 'varchar', length: 20, default: TenantPlan.TRIAL })
  plan: TenantPlan;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ length: 500, nullable: true })
  logo_url: string;

  @Column({ length: 15, nullable: true })
  gstin: string;

  @Column({ length: 100, nullable: true })
  license_no: string;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  trial_ends_at: Date;

  @CreateDateColumn()
  created_at: Date;
}
