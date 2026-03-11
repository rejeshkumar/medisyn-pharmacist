import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  // ── Mandatory (regulatory) ────────────────────────────
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
  EXPORT         = 'EXPORT',

  // ── Configurable ──────────────────────────────────────
  LOGIN               = 'LOGIN',
  LOGOUT              = 'LOGOUT',
  BULK_IMPORT         = 'BULK_IMPORT',
  QUEUE_CREATE        = 'QUEUE_CREATE',
  CONSULTATION_CREATE = 'CONSULTATION_CREATE',
  PATIENT_CREATE      = 'PATIENT_CREATE',
  PATIENT_UPDATE      = 'PATIENT_UPDATE',
  VIEW_SCHEDULE       = 'VIEW_SCHEDULE',
  AVAILABILITY_CHANGE = 'AVAILABILITY_CHANGE',
}

// Map action → config key (null = mandatory, always logged)
export const ACTION_CONFIG_KEY: Record<AuditAction, string | null> = {
  [AuditAction.CREATE]:               null,
  [AuditAction.UPDATE]:               null,
  [AuditAction.DELETE]:               null,
  [AuditAction.DISPENSE]:             null,
  [AuditAction.STOCK_IN]:             null,
  [AuditAction.STOCK_ADJUST]:         null,
  [AuditAction.VOID]:                 null,
  [AuditAction.DEACTIVATE]:           null,
  [AuditAction.ACTIVATE]:             null,
  [AuditAction.PASSWORD_RESET]:       null,
  [AuditAction.EXPORT]:               null,
  [AuditAction.LOGIN]:                'log_login_events',
  [AuditAction.LOGOUT]:              'log_login_events',
  [AuditAction.BULK_IMPORT]:          'log_bulk_imports',
  [AuditAction.QUEUE_CREATE]:         'log_queue_booking',
  [AuditAction.CONSULTATION_CREATE]:  'log_consultation',
  [AuditAction.PATIENT_CREATE]:       'log_patient_changes',
  [AuditAction.PATIENT_UPDATE]:       'log_patient_changes',
  [AuditAction.VIEW_SCHEDULE]:        'log_report_views',
  [AuditAction.AVAILABILITY_CHANGE]:  'log_availability_changes',
};

// Human-readable labels for UI
export const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.CREATE]:               'Created',
  [AuditAction.UPDATE]:               'Updated / Permissions Changed',
  [AuditAction.DELETE]:               'Deleted',
  [AuditAction.DISPENSE]:             'Dispensed',
  [AuditAction.STOCK_IN]:             'Stock In',
  [AuditAction.STOCK_ADJUST]:         'Stock Adjusted',
  [AuditAction.VOID]:                 'Voided',
  [AuditAction.DEACTIVATE]:           'Deactivated',
  [AuditAction.ACTIVATE]:             'Activated',
  [AuditAction.PASSWORD_RESET]:       'Password Reset',
  [AuditAction.EXPORT]:               'Exported',
  [AuditAction.LOGIN]:                'Login',
  [AuditAction.LOGOUT]:              'Logout',
  [AuditAction.BULK_IMPORT]:          'Bulk Import',
  [AuditAction.QUEUE_CREATE]:         'Queue Booking',
  [AuditAction.CONSULTATION_CREATE]:  'Consultation',
  [AuditAction.PATIENT_CREATE]:       'Patient Created',
  [AuditAction.PATIENT_UPDATE]:       'Patient Updated',
  [AuditAction.VIEW_SCHEDULE]:        'Report Viewed',
  [AuditAction.AVAILABILITY_CHANGE]:  'Availability Changed',
};

// Categories for filter UI
export const ACTION_CATEGORIES: Record<string, AuditAction[]> = {
  'Permissions & Users': [
    AuditAction.CREATE, AuditAction.UPDATE, AuditAction.DEACTIVATE,
    AuditAction.ACTIVATE, AuditAction.PASSWORD_RESET,
  ],
  'Stock & Dispensing': [
    AuditAction.DISPENSE, AuditAction.STOCK_IN,
    AuditAction.STOCK_ADJUST, AuditAction.VOID,
  ],
  'Clinical': [
    AuditAction.QUEUE_CREATE, AuditAction.CONSULTATION_CREATE,
    AuditAction.PATIENT_CREATE, AuditAction.PATIENT_UPDATE,
    AuditAction.AVAILABILITY_CHANGE,
  ],
  'System': [
    AuditAction.LOGIN, AuditAction.LOGOUT,
    AuditAction.BULK_IMPORT, AuditAction.EXPORT,
    AuditAction.VIEW_SCHEDULE,
  ],
};

@Entity('audit_logs')
@Index(['tenant_id', 'created_at'])
@Index(['tenant_id', 'entity', 'entity_id'])
@Index(['tenant_id', 'user_id', 'created_at'])
@Index(['tenant_id', 'action', 'created_at'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenant_id: string;

  @Column()
  user_id: string;

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

  @Column({ nullable: true })
  entity_ref: string;

  @Column({ type: 'jsonb', nullable: true })
  old_value: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  new_value: Record<string, any>;

  @Column({ nullable: true })
  ip_address: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
