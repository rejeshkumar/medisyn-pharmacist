import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { StockBatch } from './stock-batch.entity';

export enum ScheduleClass {
  OTC = 'OTC',
  H = 'H',
  H1 = 'H1',
  X = 'X',
}

export enum DosageForm {
  TABLET = 'Tablet',
  CAPSULE = 'Capsule',
  SYRUP = 'Syrup',
  INJECTION = 'Injection',
  VIAL = 'Vial',
  SUSPENSION = 'Suspension',
  DROPS = 'Drops',
  POWDER = 'Powder',
  GEL = 'Gel',
  LIQUID = 'Liquid',
  LOTION = 'Lotion',
  CREAM = 'Cream',
  EYE_DROPS = 'Eye Drops',
  OINTMENT = 'Ointment',
  SOAP = 'Soap',
  INHALER = 'Inhaler',
  PILL = 'Pill',
  PATCH = 'Patch',
  OTHER = 'Other',
}

export enum RxUnit {
  UNITS = 'units',
  TSP = 'tsp',
  ML = 'ml',
  DROPS = 'drps',
  PUFF = 'puff',
  MG = 'mg',
  MCG = 'μg',
  G = 'g',
}

export enum IntakeRoute {
  ORAL = 'Oral',
  TOPICAL = 'Topical',
  PARENTERAL = 'Parenteral',
  OPHTHALMIC = 'Ophthalmic',
  OTIC = 'Otic',
  NASAL = 'Nasal',
  INHALATION = 'Inhalation',
  SUBLINGUAL = 'Sublingual',
  RECTAL = 'Rectal',
  TRANSDERMAL = 'Transdermal',
}

@Entity('medicines')
export class Medicine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  brand_name: string;

  @Index()
  @Column()
  molecule: string;

  @Column()
  strength: string;

  @Column({ type: 'varchar', length: 50, default: 'Tablet' })
  dosage_form: string;

  @Column({ type: 'enum', enum: ScheduleClass, default: ScheduleClass.OTC })
  schedule_class: ScheduleClass;

  @Index()
  @Column({ nullable: true })
  substitute_group_key: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gst_percent: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  mrp: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  sale_rate: number;

  @Column({ nullable: true })
  manufacturer: string;

  @Column({ nullable: true })
  category: string;

  // ── New fields from pharmacy drug master ─────────────────────────────────

  @Column({ type: 'varchar', length: 20, nullable: true })
  rx_units: string;

  @Column({ nullable: true })
  stock_group: string;

  @Column({ nullable: true })
  treatment_for: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  discount_percent: number;

  @Column({ nullable: true })
  rack_location: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  intake_route: string;

  @Column({ type: 'int', default: 0 })
  reorder_qty: number;

  @Column({ default: false })
  is_rx_required: boolean;

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => StockBatch, (batch) => batch.medicine)
  batches: StockBatch[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
