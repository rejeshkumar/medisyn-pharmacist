import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction, ACTION_CONFIG_KEY } from '../database/entities/audit-log.entity';
import { AuditConfig } from '../database/entities/audit-config.entity';

export interface AuditEntry {
  tenantId:   string;
  userId:     string;
  userName:   string;
  userRole:   string;
  action:     AuditAction;
  entity:     string;
  entityId?:  string;
  entityRef?: string;
  oldValue?:  Record<string, any>;
  newValue?:  Record<string, any>;
  ip?:        string;
}

@Injectable()
export class AuditService {
  // In-memory config cache per tenant (TTL: 5 min) to avoid DB hit on every log
  private configCache = new Map<string, { config: AuditConfig; expiresAt: number }>();

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    @InjectRepository(AuditConfig)
    private readonly configRepo: Repository<AuditConfig>,
  ) {}

  // ── Get config with 5-min cache ───────────────────────────────────
  private async getConfig(tenantId: string): Promise<AuditConfig | null> {
    const cached = this.configCache.get(tenantId);
    if (cached && cached.expiresAt > Date.now()) return cached.config;

    const config = await this.configRepo.findOne({ where: { tenant_id: tenantId } });
    if (config) {
      this.configCache.set(tenantId, { config, expiresAt: Date.now() + 5 * 60 * 1000 });
    }
    return config;
  }

  // ── Invalidate cache when config is updated ───────────────────────
  invalidateCache(tenantId: string) {
    this.configCache.delete(tenantId);
  }

  // ── Main log method ───────────────────────────────────────────────
  async log(entry: AuditEntry): Promise<void> {
    try {
      const configKey = ACTION_CONFIG_KEY[entry.action];

      // Mandatory events (configKey = null) — always log, skip config check
      if (configKey !== null) {
        const config = await this.getConfig(entry.tenantId);
        // If no config row exists yet, use defaults from entity
        if (config && !(config as any)[configKey]) {
          return; // This event type is disabled for this tenant
        }
      }

      await this.repo.save({
        tenant_id:  entry.tenantId,
        user_id:    entry.userId,
        user_name:  entry.userName,
        user_role:  entry.userRole,
        action:     entry.action,
        entity:     entry.entity,
        entity_id:  entry.entityId  ?? null,
        entity_ref: entry.entityRef ?? null,
        old_value:  entry.oldValue  ?? null,
        new_value:  entry.newValue  ?? null,
        ip_address: entry.ip        ?? null,
      });
    } catch (err) {
      // Audit failures must NEVER crash the main operation
      console.error('[AuditService] Failed to write audit log:', err?.message, entry);
    }
  }

  // ── Query logs with filters ───────────────────────────────────────
  async getLogs(tenantId: string, filters: {
    action?: string;
    entity?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 50;

    const qb = this.repo.createQueryBuilder('l')
      .where('l.tenant_id = :tenantId', { tenantId })
      .orderBy('l.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (filters.action) qb.andWhere('l.action = :action', { action: filters.action });
    if (filters.entity) qb.andWhere('l.entity = :entity', { entity: filters.entity });
    if (filters.userId) qb.andWhere('l.user_id = :userId', { userId: filters.userId });
    if (filters.from)   qb.andWhere('l.created_at >= :from', { from: new Date(filters.from) });
    if (filters.to)     qb.andWhere('l.created_at <= :to',   { to: new Date(filters.to) });

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit, pages: Math.ceil(total / limit) };
  }

  // ── Get / upsert config ───────────────────────────────────────────
  async getConfigForTenant(tenantId: string): Promise<AuditConfig> {
    let config = await this.configRepo.findOne({ where: { tenant_id: tenantId } });
    if (!config) {
      // Create default config
      config = this.configRepo.create({ tenant_id: tenantId });
      config = await this.configRepo.save(config);
    }
    return config;
  }

  async updateConfig(tenantId: string, updates: Partial<AuditConfig>): Promise<AuditConfig> {
    let config = await this.configRepo.findOne({ where: { tenant_id: tenantId } });
    if (!config) {
      config = this.configRepo.create({ tenant_id: tenantId, ...updates });
    } else {
      Object.assign(config, updates);
    }
    const saved = await this.configRepo.save(config);
    this.invalidateCache(tenantId); // clear cache immediately
    return saved;
  }
}
