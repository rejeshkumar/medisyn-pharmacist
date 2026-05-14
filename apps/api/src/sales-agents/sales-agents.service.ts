import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalesAgent } from '../database/entities/sales-agent.entity';
import { VipRegistration } from '../database/entities/vip-registration.entity';

@Injectable()
export class SalesAgentsService {
  constructor(
    @InjectRepository(SalesAgent)
    private agentRepo: Repository<SalesAgent>,
    @InjectRepository(VipRegistration)
    private vipRegRepo: Repository<VipRegistration>,
  ) {}

  async validateAgentToken(agentCode: string, token: string, tenantId: string): Promise<SalesAgent> {
    const agent = await this.agentRepo.findOne({
      where: { agent_code: agentCode, access_token: token, tenant_id: tenantId, is_active: true },
    });

    if (!agent) {
      throw new NotFoundException('Invalid agent credentials');
    }

    return agent;
  }

  async getSalesDashboard(tenantId: string, agentId?: string) {
    const qb = this.vipRegRepo
      .createQueryBuilder('vr')
      .leftJoinAndSelect('vr.agent', 'agent')
      .where('vr.tenant_id = :tenantId', { tenantId });

    if (agentId) {
      qb.andWhere('vr.agent_id = :agentId', { agentId });
    }

    const registrations = await qb.getMany();

    const stats = {
      total_registrations: registrations.length,
      total_revenue: registrations.reduce((sum, r) => sum + Number(r.payment_amount), 0),
      upi_count: registrations.filter(r => r.payment_method === 'upi').length,
      upi_amount: registrations.filter(r => r.payment_method === 'upi').reduce((sum, r) => sum + Number(r.payment_amount), 0),
      cash_count: registrations.filter(r => r.payment_method === 'cash').length,
      cash_amount: registrations.filter(r => r.payment_method === 'cash').reduce((sum, r) => sum + Number(r.payment_amount), 0),
      by_category: {
        individual: registrations.filter(r => r.vip_category === 'individual').length,
        family: registrations.filter(r => r.vip_category === 'family').length,
        extended: registrations.filter(r => r.vip_category === 'extended').length,
      },
    };

    return stats;
  }

  async getAgentPerformance(tenantId: string) {
    const agents = await this.agentRepo.find({
      where: { tenant_id: tenantId, is_active: true },
    });

    const performance = await Promise.all(
      agents.map(async (agent) => {
        const stats = await this.getSalesDashboard(tenantId, agent.id);
        return {
          agent_id: agent.id,
          agent_name: agent.agent_name,
          agent_code: agent.agent_code,
          ...stats,
          commission_earned: stats.total_revenue * (Number(agent.commission_rate) / 100),
        };
      }),
    );

    return performance;
  }

  async checkRateLimit(agentId: string, tenantId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const count = await this.vipRegRepo
      .createQueryBuilder('vr')
      .where('vr.agent_id = :agentId', { agentId })
      .andWhere('vr.tenant_id = :tenantId', { tenantId })
      .andWhere('vr.registered_at >= :oneHourAgo', { oneHourAgo })
      .getCount();

    return count < 10; // Max 10 registrations per hour
  }
}
