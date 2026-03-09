import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface AuditFilters {
  from?:     string;
  to?:       string;
  userId?:   string;
  action?:   string;
  entity?:   string;
  entityId?: string;
  page:      number;
  limit:     number;
}

@Injectable()
export class AuditQueryService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async getLogs(tenantId: string, filters: AuditFilters) {
    const { from, to, userId, action, entity, entityId, page, limit } = filters;

    const qb = this.repo
      .createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId })
      .orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (from) {
      qb.andWhere('log.created_at >= :from', { from: new Date(from) });
    }
    if (to) {
      // Include the full end day
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('log.created_at <= :to', { to: toDate });
    }
    if (userId)   qb.andWhere('log.user_id = :userId',     { userId });
    if (action)   qb.andWhere('log.action = :action',       { action });
    if (entity)   qb.andWhere('log.entity = :entity',       { entity });
    if (entityId) qb.andWhere('log.entity_id = :entityId', { entityId });

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getSummary(tenantId: string, filters: { from?: string; to?: string }) {
    const { from, to } = filters;

    const qb = this.repo
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.tenant_id = :tenantId', { tenantId })
      .groupBy('log.action')
      .orderBy('count', 'DESC');

    if (from) qb.andWhere('log.created_at >= :from', { from: new Date(from) });
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      qb.andWhere('log.created_at <= :to', { to: toDate });
    }

    const rows = await qb.getRawMany();

    // Also get unique users active in this period
    const activeUsersQb = this.repo
      .createQueryBuilder('log')
      .select('log.user_id', 'user_id')
      .addSelect('log.user_name', 'user_name')
      .addSelect('COUNT(*)', 'count')
      .where('log.tenant_id = :tenantId', { tenantId })
      .groupBy('log.user_id')
      .addGroupBy('log.user_name')
      .orderBy('count', 'DESC');

    if (from) activeUsersQb.andWhere('log.created_at >= :from', { from: new Date(from) });
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      activeUsersQb.andWhere('log.created_at <= :to', { to: toDate });
    }

    const activeUsers = await activeUsersQb.getRawMany();

    return {
      by_action: rows.map(r => ({ action: r.action, count: Number(r.count) })),
      by_user:   activeUsers.map(r => ({
        user_id:   r.user_id,
        user_name: r.user_name,
        count:     Number(r.count),
      })),
      total_events: rows.reduce((sum, r) => sum + Number(r.count), 0),
    };
  }
}
