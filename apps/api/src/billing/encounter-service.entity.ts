import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Queue } from '../queue/queue.entity';

export enum EncounterServiceStatus {
  ORDERED     = 'ordered',
  IN_PROGRESS = 'in_progress',
  COMPLETED   = 'completed',
  CANCELLED   = 'cancelled',
}

@Entity('encounter_services')
export class EncounterService {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'uuid' }) tenant_id: string;
  @ManyToOne(() => Tenant) @JoinColumn({ name: 'tenant_id' }) tenant: Tenant;

  @Column({ type: 'uuid' }) queue_id: string;
  @ManyToOne(() => Queue) @JoinColumn({ name: 'queue_id' }) queue: Queue;

  @Column({ type: 'uuid', nullable: true }) service_rate_id: string;

  @Column({ type: 'varchar', length: 200 }) name: string;
  @Column({ type: 'varchar', length: 50 }) category: string;
  @Column({ type: 'varchar', length: 20, default: 'doctor' }) ordered_by_role: string;

  @Column({ type: 'uuid', nullable: true }) ordered_by: string;
  @ManyToOne(() => User, { nullable: true }) @JoinColumn({ name: 'ordered_by' }) ordered_by_user: User;

  @Column({ type: 'timestamptz', default: () => 'now()' }) ordered_at: Date;

  @Column({
    type: 'enum',
    enum: EncounterServiceStatus,
    default: EncounterServiceStatus.ORDERED,
  })
  status: EncounterServiceStatus;

  @Column({ type: 'uuid', nullable: true }) completed_by: string;
  @Column({ type: 'timestamptz', nullable: true }) completed_at: Date;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 }) price: number;
  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 }) gst_percent: number;
  @Column({ type: 'varchar', length: 20, nullable: true }) notify_role: string;
  @Column({ type: 'text', nullable: true }) notes: string;

  @CreateDateColumn({ type: 'timestamptz' }) created_at: Date;
  @UpdateDateColumn({ type: 'timestamptz' }) updated_at: Date;
}
