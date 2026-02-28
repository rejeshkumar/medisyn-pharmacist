import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Medicine } from './medicine.entity';
import { Supplier } from './supplier.entity';

@Entity('stock_batches')
export class StockBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  medicine_id: string;

  @ManyToOne(() => Medicine, (medicine) => medicine.batches)
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column()
  batch_number: string;

  @Index()
  @Column({ type: 'date' })
  expiry_date: Date;

  @Index()
  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  purchase_price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  mrp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  sale_rate: number;

  @Column({ nullable: true })
  supplier_id: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.batches, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ nullable: true })
  purchase_invoice_no: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
