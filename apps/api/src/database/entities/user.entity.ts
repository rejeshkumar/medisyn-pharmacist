import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Tenant } from './tenant.entity';

export enum UserRole {
  OWNER      = 'owner',
  PHARMACIST = 'pharmacist',
  ASSISTANT  = 'assistant',
  DOCTOR        = 'doctor',
  RECEPTIONIST  = 'receptionist',
  NURSE         = 'nurse',
}

export enum UserStatus {
  ACTIVE   = 'active',
  INACTIVE = 'inactive',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Tenant isolation ──────────────────────────────────
  @Column({ default: '00000000-0000-0000-0000-000000000001' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  // ── Core fields ───────────────────────────────────────
  @Column()
  full_name: string;

  @Column({ unique: true })
  mobile: string;

  @Exclude()
  @Column({ nullable: true })
  password_hash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.PHARMACIST })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  // ── Audit trail ───────────────────────────────────────
  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
