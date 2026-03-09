import { Repository } from 'typeorm';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class ComplianceService {
    private logRepo;
    private auditService;
    constructor(logRepo: Repository<ScheduleDrugLog>, auditService: AuditService);
    getScheduleDrugLog(tenantId: string, filters: {
        from?: string;
        to?: string;
        doctorName?: string;
        medicine?: string;
        scheduleClass?: string;
    }): Promise<ScheduleDrugLog[]>;
    exportToExcel(tenantId: string, filters: any, user: UserContext): Promise<Buffer>;
}
