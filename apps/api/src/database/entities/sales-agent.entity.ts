import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sales_agents')
export class SalesAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ length: 100 })
  agent_name: string;

  @Column({ length: 50, unique: true })
  agent_code: string;

  @Column({ length: 100 })
  access_token: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 99.00 })
  commission_individual: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 149.00 })
  commission_family: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 199.00 })
  commission_extended: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
