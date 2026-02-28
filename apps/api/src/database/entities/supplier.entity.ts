import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { StockBatch } from './stock-batch.entity';

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  gstin: string;

  @Column({ nullable: true })
  address: string;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => StockBatch, (batch) => batch.supplier)
  batches: StockBatch[];

  @CreateDateColumn()
  created_at: Date;
}
