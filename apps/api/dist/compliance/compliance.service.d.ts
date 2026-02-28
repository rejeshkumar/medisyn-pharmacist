import { Repository } from 'typeorm';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
export declare class ComplianceService {
    private logRepo;
    constructor(logRepo: Repository<ScheduleDrugLog>);
    getScheduleDrugLog(filters: {
        from?: string;
        to?: string;
        doctorName?: string;
        medicine?: string;
        scheduleClass?: string;
    }): Promise<ScheduleDrugLog[]>;
    exportToExcel(filters: any): Promise<Buffer>;
}
