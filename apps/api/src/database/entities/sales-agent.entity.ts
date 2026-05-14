import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('sales_agents')
export class SalesAgent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenant_id: string;

  @Column({ length: 100 })
  agent_name: string;

  @Column({ length: 50 })
  agent_code: string;

  @Column({ length: 100, unique: true })
  access_token: string;

  @Column({ length: 15, nullable: true })
  mobile?: string;

  @Column({ length: 100, nullable: true })
  email?: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.00 })
  commission_rate: number;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by?: string;
}
