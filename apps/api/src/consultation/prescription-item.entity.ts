import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Tenant } from '../database/entities/tenant.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { Prescription } from './prescription.entity';

@Entity('prescription_items')
export class PrescriptionItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  prescription_id: string;

  @ManyToOne(() => Prescription, prescription => prescription.items)
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  @Column({ type: 'uuid', nullable: true })
  medicine_id: string;

  @ManyToOne(() => Medicine, { nullable: true })
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column({ type: 'varchar', length: 255 })
  medicine_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dosage: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  duration: string;

  @Column({ type: 'int', nullable: true })
  quantity: number;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ default: false })
  is_dispensed: boolean;

  @Column({ default: true })
  is_active: boolean;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @Column({ type: 'uuid', nullable: true })
  updated_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
