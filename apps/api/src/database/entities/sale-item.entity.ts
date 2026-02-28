import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Medicine } from './medicine.entity';
import { StockBatch } from './stock-batch.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sale_id: string;

  @ManyToOne(() => Sale, (sale) => sale.items)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column()
  medicine_id: string;

  @ManyToOne(() => Medicine)
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column()
  batch_id: string;

  @ManyToOne(() => StockBatch)
  @JoinColumn({ name: 'batch_id' })
  batch: StockBatch;

  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  rate: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gst_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  item_total: number;

  @Column({ default: false })
  is_substituted: boolean;

  @Column({ nullable: true })
  original_medicine_id: string;

  @Column({ nullable: true })
  substitution_reason: string;

  @Column({ nullable: true })
  medicine_name: string;

  @Column({ nullable: true })
  batch_number: string;
}
