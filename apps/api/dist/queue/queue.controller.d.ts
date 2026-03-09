import { QueueService } from './queue.service';
import { CreateQueueDto, UpdateQueueStatusDto, RecordPreCheckDto } from './queue.dto';
export declare class QueueController {
    private readonly queueService;
    constructor(queueService: QueueService);
    register(dto: CreateQueueDto, req: any): Promise<import("./queue.entity").Queue>;
    getTodayQueue(req: any, doctorId?: string): Promise<import("./queue.entity").Queue[]>;
    getTodayStats(req: any): Promise<any>;
    getPreCheck(id: string, req: any): Promise<import("./pre-check.entity").PreCheck>;
    getById(id: string, req: any): Promise<import("./queue.entity").Queue>;
    updateStatus(id: string, dto: UpdateQueueStatusDto, req: any): Promise<import("./queue.entity").Queue>;
    recordPreCheck(dto: RecordPreCheckDto, req: any): Promise<import("./pre-check.entity").PreCheck>;
}
