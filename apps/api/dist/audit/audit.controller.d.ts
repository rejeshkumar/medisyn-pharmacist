import { AuditQueryService } from './audit-query.service';
export declare class AuditController {
    private readonly auditQueryService;
    constructor(auditQueryService: AuditQueryService);
    getLogs(req: any, from?: string, to?: string, userId?: string, action?: string, entity?: string, entityId?: string, page?: number, limit?: number): Promise<{
        data: import("../database/entities/audit-log.entity").AuditLog[];
        meta: {
            total: number;
            page: number;
            limit: number;
            pages: number;
        };
    }>;
    getSummary(req: any, from?: string, to?: string): Promise<{
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
