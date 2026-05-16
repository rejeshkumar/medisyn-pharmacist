import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { SalesAgent } from '../database/entities/sales-agent.entity';
import { VipRegistration } from '../database/entities/vip-registration.entity';

@Injectable()
export class SalesAgentsService {
  constructor(
    @InjectRepository(SalesAgent)
    private salesAgentRepo: Repository<SalesAgent>,
    @InjectRepository(VipRegistration)
    private vipRegRepo: Repository<VipRegistration>,
  ) {}

  async validateAgentToken(agentCode: string, accessToken: string, tenantId: string): Promise<SalesAgent> {
    const agent = await this.salesAgentRepo.findOne({
      where: {
        agent_code: agentCode,
        access_token: accessToken,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!agent) {
      throw new Error('Invalid agent credentials');
    }

    return agent;
  }

  async checkRateLimit(agentId: string, tenantId: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await this.vipRegRepo
      .createQueryBuilder('reg')
      .where('reg.agent_id = :agentId', { agentId })
      .andWhere('reg.tenant_id = :tenantId', { tenantId })
      .andWhere('reg.created_at > :oneHourAgo', { oneHourAgo })
      .getCount();

    return recentCount < 10;
  }

  async getSalesDashboard(tenantId: string) {
    const registrations = await this.vipRegRepo.find({
      where: { tenant_id: tenantId },
      relations: ['agent'],
    });

    const totalRegistrations = registrations.length;
    const totalRevenue = registrations.reduce((sum, reg) => sum + Number(reg.payment_amount), 0);

    const upiRegistrations = registrations.filter(r => r.payment_method === 'upi');
    const cashRegistrations = registrations.filter(r => r.payment_method === 'cash');
    const upiRevenue = upiRegistrations.reduce((sum, reg) => sum + Number(reg.payment_amount), 0);
    const cashRevenue = cashRegistrations.reduce((sum, reg) => sum + Number(reg.payment_amount), 0);

    const byCategory = {
      individual: registrations.filter(r => r.vip_category === 'individual').length,
      family: registrations.filter(r => r.vip_category === 'family').length,
      extended: registrations.filter(r => r.vip_category === 'extended').length,
    };

    // Calculate total commission based on fixed amounts per plan
    const totalCommission = registrations.reduce((sum, reg) => {
      const agent = reg.agent as any;
      if (!agent) return sum;
      
      let commission = 0;
      if (reg.vip_category === 'individual') {
        commission = Number(agent.commission_individual || 99);
      } else if (reg.vip_category === 'family') {
        commission = Number(agent.commission_family || 149);
      } else if (reg.vip_category === 'extended') {
        commission = Number(agent.commission_extended || 199);
      }
      return sum + commission;
    }, 0);

    return {
      totalRegistrations,
      totalRevenue,
      totalCommission,
      paymentBreakdown: {
        upi: {
          count: upiRegistrations.length,
          revenue: upiRevenue,
        },
        cash: {
          count: cashRegistrations.length,
          revenue: cashRevenue,
        },
      },
      categoryBreakdown: byCategory,
    };
  }

  async getAgentPerformance(tenantId: string) {
    const agents = await this.salesAgentRepo.find({
      where: { tenant_id: tenantId },
    });

    const performance = await Promise.all(
      agents.map(async (agent) => {
        const registrations = await this.vipRegRepo.find({
          where: { agent_id: agent.id, tenant_id: tenantId },
        });

        const revenue = registrations.reduce((sum, reg) => sum + Number(reg.payment_amount), 0);
        
        // Calculate commission based on fixed amounts per plan
        const commission = registrations.reduce((sum, reg) => {
          let commissionAmount = 0;
          if (reg.vip_category === 'individual') {
            commissionAmount = Number(agent.commission_individual);
          } else if (reg.vip_category === 'family') {
            commissionAmount = Number(agent.commission_family);
          } else if (reg.vip_category === 'extended') {
            commissionAmount = Number(agent.commission_extended);
          }
          return sum + commissionAmount;
        }, 0);

        const byCategory = {
          individual: registrations.filter(r => r.vip_category === 'individual').length,
          family: registrations.filter(r => r.vip_category === 'family').length,
          extended: registrations.filter(r => r.vip_category === 'extended').length,
        };

        return {
          agentName: agent.agent_name,
          agentCode: agent.agent_code,
          totalRegistrations: registrations.length,
          revenue,
          commission,
          commissionStructure: {
            individual: agent.commission_individual,
            family: agent.commission_family,
            extended: agent.commission_extended,
          },
          categoryBreakdown: byCategory,
        };
      }),
    );

    return performance;
  }
}
