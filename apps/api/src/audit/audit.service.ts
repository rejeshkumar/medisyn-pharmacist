import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../database/entities/audit-log.entity';

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
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
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
      // Audit failures must NEVER crash the main operation.
      // Log to console so we can monitor — never throw.
      console.error('[AuditService] Failed to write audit log:', err?.message, entry);
    }
  }
}
