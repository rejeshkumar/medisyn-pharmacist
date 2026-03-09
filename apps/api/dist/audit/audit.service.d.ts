import { Repository } from 'typeorm';
import { AuditLog, AuditAction } from '../database/entities/audit-log.entity';
export interface AuditEntry {
    tenantId: string;
    userId: string;
    userName: string;
    userRole: string;
    action: AuditAction;
    entity: string;
    entityId?: string;
    entityRef?: string;
    oldValue?: Record<string, any>;
    newValue?: Record<string, any>;
    ip?: string;
}
export declare class AuditService {
    private readonly repo;
    constructor(repo: Repository<AuditLog>);
    log(entry: AuditEntry): Promise<void>;
}
