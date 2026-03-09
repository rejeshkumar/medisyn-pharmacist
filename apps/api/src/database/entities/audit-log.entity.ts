import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE         = 'CREATE',
  UPDATE         = 'UPDATE',
  DELETE         = 'DELETE',
  DISPENSE       = 'DISPENSE',
  STOCK_IN       = 'STOCK_IN',
  STOCK_ADJUST   = 'STOCK_ADJUST',
  VOID           = 'VOID',
  DEACTIVATE     = 'DEACTIVATE',
  ACTIVATE       = 'ACTIVATE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  VIEW_SCHEDULE  = 'VIEW_SCHEDULE',
  EXPORT         = 'EXPORT',
}

@Entity('audit_logs')
@Index(['tenant_id', 'created_at'])
@Index(['tenant_id', 'entity', 'entity_id'])
@Index(['tenant_id', 'user_id', 'created_at'])
@Index(['tenant_id', 'action', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // tenant_id as plain column — no FK relation to keep audit writes fast
  @Column({ default: '00000000-0000-0000-0000-000000000001' })
  tenant_id: string;

  @Column()
  user_id: string;

  // Denormalised — preserved even if user is later deactivated
  @Column()
  user_name: string;

  @Column()
  user_role: string;

  @Column({ type: 'varchar' })
  action: AuditAction;

  @Column()
  entity: string;

  @Column({ nullable: true })
  entity_id: string;

  // Human-readable reference e.g. "Bill #INV-0042", "Paracetamol 500mg"
  @Column({ nullable: true })
  entity_ref: string;

  // Snapshot BEFORE the change (null for CREATE)
  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, any>;

  // Snapshot AFTER the change (null for DELETE)
  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, any>;

  @Column({ nullable: true })
  ip_address: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
