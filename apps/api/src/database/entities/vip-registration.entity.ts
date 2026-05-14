import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from './patient.entity';
import { SalesAgent } from './sales-agent.entity';

@Entity('vip_registrations')
export class VipRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ type: 'uuid' })
  patient_id: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true })
  agent_id?: string;

  @ManyToOne(() => SalesAgent)
  @JoinColumn({ name: 'agent_id' })
  agent: SalesAgent;

  @Column({ length: 20 })
  vip_category: string;

  @Column({ length: 20 })
  payment_method: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  payment_amount: number;

  @Column({ length: 50, nullable: true })
  upi_txn_id?: string;

  @CreateDateColumn()
  registered_at: Date;

  @Column({ length: 50, nullable: true })
  ip_address?: string;
}
