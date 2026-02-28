import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';

@Entity('schedule_drug_logs')
export class ScheduleDrugLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  sale_id: string;

  @ManyToOne(() => Sale)
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column()
  sale_item_id: string;

  @ManyToOne(() => SaleItem)
  @JoinColumn({ name: 'sale_item_id' })
  sale_item: SaleItem;

  @Column()
  patient_name: string;

  @Column()
  doctor_name: string;

  @Column({ nullable: true })
  doctor_reg_no: string;

  @Column({ nullable: true })
  prescription_image_url: string;

  @Column()
  medicine_name: string;

  @Column()
  schedule_class: string;

  @Column({ type: 'int' })
  quantity_dispensed: number;

  @Column()
  batch_number: string;

  @Column()
  pharmacist_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'pharmacist_id' })
  pharmacist: User;

  @Column({ default: false })
  is_substituted: boolean;

  @Column({ nullable: true })
  substitution_reason: string;

  @CreateDateColumn()
  created_at: Date;
}
