import { Repository, DataSource } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
export declare class SalesService {
    private saleRepo;
    private saleItemRepo;
    private batchRepo;
    private medicineRepo;
    private scheduleLogRepo;
    private dataSource;
    constructor(saleRepo: Repository<Sale>, saleItemRepo: Repository<SaleItem>, batchRepo: Repository<StockBatch>, medicineRepo: Repository<Medicine>, scheduleLogRepo: Repository<ScheduleDrugLog>, dataSource: DataSource);
    createSale(dto: CreateSaleDto, userId: string): Promise<Sale>;
    private isScheduledDrug;
    findAll(from?: string, to?: string, search?: string): Promise<Sale[]>;
    findOne(id: string): Promise<Sale>;
    findByBillNumber(billNumber: string): Promise<Sale>;
    voidSale(id: string, reason: string, userId: string): Promise<{
        message: string;
    }>;
    private generateBillNumber;
}
