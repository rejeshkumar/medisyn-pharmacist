import { Repository, DataSource } from 'typeorm';
import { Queue } from './queue.entity';
import { PreCheck } from './pre-check.entity';
import { CreateQueueDto, UpdateQueueStatusDto, RecordPreCheckDto } from './queue.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class QueueService {
    private queueRepo;
    private preCheckRepo;
    private auditService;
    private dataSource;
    constructor(queueRepo: Repository<Queue>, preCheckRepo: Repository<PreCheck>, auditService: AuditService, dataSource: DataSource);
    private getNextToken;
    register(dto: CreateQueueDto, tenantId: string, user: UserContext): Promise<Queue>;
    getTodayQueue(tenantId: string, doctorId?: string): Promise<Queue[]>;
    getById(id: string, tenantId: string): Promise<Queue>;
    updateStatus(id: string, dto: UpdateQueueStatusDto, tenantId: string, user: UserContext): Promise<Queue>;
    getTodayStats(tenantId: string): Promise<any>;
    recordPreCheck(dto: RecordPreCheckDto, tenantId: string, user: UserContext): Promise<PreCheck>;
    getPreCheckByQueue(queueId: string, tenantId: string): Promise<PreCheck>;
}
