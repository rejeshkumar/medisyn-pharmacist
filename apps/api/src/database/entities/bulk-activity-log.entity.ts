import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum BulkActionType {
  BULK_IMPORT_MEDICINE = 'bulk_import_medicine',
  BULK_IMPORT_STOCK = 'bulk_import_stock',
  BULK_MODIFY_MEDICINE = 'bulk_modify_medicine',
  BULK_MODIFY_STOCK = 'bulk_modify_stock',
}

@Entity('bulk_activity_logs')
export class BulkActivityLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: BulkActionType })
  action_type: BulkActionType;

  @Column()
  file_name: string;

  @Column({ type: 'int', default: 0 })
  total_rows: number;

  @Column({ type: 'int', default: 0 })
  success_rows: number;

  @Column({ type: 'int', default: 0 })
  failed_rows: number;

  @Column()
  performed_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  user: User;

  @Column({ nullable: true })
  error_file_url: string;

  @CreateDateColumn()
  created_at: Date;
}
