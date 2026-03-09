import { Repository } from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';
export interface AuditFilters {
    from?: string;
    to?: string;
    userId?: string;
    action?: string;
    entity?: string;
    entityId?: string;
    page: number;
    limit: number;
}
export declare class AuditQueryService {
    private readonly repo;
    constructor(repo: Repository<AuditLog>);
    getLogs(tenantId: string, filters: AuditFilters): Promise<{
        data: AuditLog[];
        meta: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    getSummary(tenantId: string, filters: {
        from?: string;
        to?: string;
    }): Promise<{
        by_action: {
            action: any;
            count: number;
        }[];
        by_user: {
            user_id: any;
            user_name: any;
            count: number;
        }[];
        total_events: any;
    }>;
}
