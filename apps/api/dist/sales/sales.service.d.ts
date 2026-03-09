import { Repository, DataSource } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuditService } from '../audit/audit.service';
export interface UserContext {
    id: string;
    full_name: string;
    role: string;
    tenant_id: string;
}
export declare class SalesService {
    private saleRepo;
    private saleItemRepo;
    private batchRepo;
    private medicineRepo;
    private scheduleLogRepo;
    private dataSource;
    private auditService;
    constructor(saleRepo: Repository<Sale>, saleItemRepo: Repository<SaleItem>, batchRepo: Repository<StockBatch>, medicineRepo: Repository<Medicine>, scheduleLogRepo: Repository<ScheduleDrugLog>, dataSource: DataSource, auditService: AuditService);
    createSale(dto: CreateSaleDto, user: UserContext): Promise<Sale>;
    findAll(tenantId: string, from?: string, to?: string, search?: string): Promise<Sale[]>;
    findOne(id: string, tenantId: string): Promise<Sale>;
    findByBillNumber(billNumber: string, tenantId: string): Promise<Sale>;
    voidSale(id: string, reason: string, user: UserContext): Promise<{
        message: string;
    }>;
    private generateBillNumber;
}
