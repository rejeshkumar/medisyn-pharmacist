import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

// Which audit events are mandatory (regulatory) vs configurable
export const MANDATORY_ACTIONS = [
  'CREATE',         // user created
  'UPDATE',         // role/permission changes
  'DEACTIVATE',     // user deactivated
  'ACTIVATE',       // user activated
  'PASSWORD_RESET', // password reset
  'DISPENSE',       // medicine dispensed
  'STOCK_IN',       // stock received
  'STOCK_ADJUST',   // stock adjustment
  'VOID',           // bill voided
  'EXPORT',         // data exported
];

@Entity('audit_config')
export class AuditConfig {
  @PrimaryColumn({ type: 'uuid' })
  tenant_id: string;

  // ── Configurable events ───────────────────────────────
  @Column({ default: true })
  log_login_events: boolean;       // LOGIN / LOGOUT

  @Column({ default: true })
  log_bulk_imports: boolean;       // BULK_IMPORT

  @Column({ default: false })
  log_queue_booking: boolean;      // QUEUE_CREATE

  @Column({ default: false })
  log_consultation: boolean;       // CONSULTATION_CREATE

  @Column({ default: false })
  log_patient_changes: boolean;    // PATIENT_CREATE / PATIENT_UPDATE

  @Column({ default: false })
  log_report_views: boolean;       // VIEW_SCHEDULE / report views

  @Column({ default: false })
  log_availability_changes: boolean; // doctor schedule changes

  @UpdateDateColumn()
  updated_at: Date;
}
