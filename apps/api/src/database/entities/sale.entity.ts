import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { SaleItem } from './sale-item.entity';

export enum PaymentMode {
  CASH = 'cash',
  CARD = 'card',
  UPI = 'upi',
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  bill_number: string;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true })
  doctor_name: string;

  @Column({ nullable: true })
  doctor_reg_no: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  subtotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  discount_amount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  tax_amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  total_amount: number;

  @Column({ type: 'enum', enum: PaymentMode, default: PaymentMode.CASH })
  payment_mode: PaymentMode;

  @Column({ nullable: true })
  prescription_image_url: string;

  @Column({ nullable: true })
  ai_prescription_id: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ default: false })
  has_scheduled_drugs: boolean;

  @Column({ default: false })
  is_voided: boolean;

  @Column({ nullable: true })
  voided_by: string;

  @Column({ nullable: true })
  voided_reason: string;

  @Column()
  created_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  pharmacist: User;

  @OneToMany(() => SaleItem, (item) => item.sale, { cascade: true })
  items: SaleItem[];

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
