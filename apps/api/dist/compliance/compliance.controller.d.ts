import { Response } from 'express';
import { ComplianceService } from './compliance.service';
export declare class ComplianceController {
    private complianceService;
    constructor(complianceService: ComplianceService);
    getLog(from?: string, to?: string, doctorName?: string, medicine?: string, scheduleClass?: string): Promise<import("../database/entities/schedule-drug-log.entity").ScheduleDrugLog[]>;
    exportLog(from: string, to: string, res: Response): Promise<void>;
}
