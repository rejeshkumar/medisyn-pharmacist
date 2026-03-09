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


  @Column({ default: '00000000-0000-0000-0000-000000000001' })
  tenant_id: string;

  @Column({ nullable: true })
  created_by: string;

  @Column({ nullable: true })
  updated_by: string;
  @CreateDateColumn()
  created_at: Date;
}
