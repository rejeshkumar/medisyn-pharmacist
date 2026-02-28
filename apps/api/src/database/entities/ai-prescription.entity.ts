import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ExtractionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('ai_prescriptions')
export class AiPrescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  sale_id: string;

  @Column()
  uploaded_by: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by' })
  uploader: User;

  @Column()
  image_url: string;

  @Column({ type: 'jsonb', nullable: true })
  extraction_json: any;

  @Column({ nullable: true })
  patient_name: string;

  @Column({ nullable: true })
  doctor_name: string;

  @Column({ nullable: true })
  confidence_summary: string;

  @Column({
    type: 'enum',
    enum: ExtractionStatus,
    default: ExtractionStatus.PENDING,
  })
  status: ExtractionStatus;

  @Column({ nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;
}
