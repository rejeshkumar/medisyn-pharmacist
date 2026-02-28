import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { StockBatch } from './stock-batch.entity';
import { User } from './user.entity';

export enum AdjustmentType {
  EXPIRED = 'expired',
  BREAKAGE = 'breakage',
  SAMPLE = 'sample',
  CORRECTION = 'correction',
  THEFT_LOSS = 'theft_loss',
  SUPPLIER_RETURN = 'supplier_return',
}

@Entity('stock_adjustments')
export class StockAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  batch_id: string;

  @ManyToOne(() => StockBatch)
  @JoinColumn({ name: 'batch_id' })
  batch: StockBatch;

  @Column({ type: 'int' })
  quantity_change: number;

  @Column({ type: 'int' })
  quantity_before: number;

  @Column({ type: 'int' })
  quantity_after: number;

  @Column({ type: 'enum', enum: AdjustmentType })
  adjustment_type: AdjustmentType;

  @Column({ nullable: true })
  notes: string;

  @Column()
  performed_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by' })
  user: User;

  @CreateDateColumn()
  created_at: Date;
}
