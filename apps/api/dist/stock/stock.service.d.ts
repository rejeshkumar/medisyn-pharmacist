import { Repository } from 'typeorm';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class StockService {
    private batchRepo;
    private adjustmentRepo;
    private supplierRepo;
    private medicineRepo;
    private auditService;
    constructor(batchRepo: Repository<StockBatch>, adjustmentRepo: Repository<StockAdjustment>, supplierRepo: Repository<Supplier>, medicineRepo: Repository<Medicine>, auditService: AuditService);
    getStockList(tenantId: string, filters: {
        search?: string;
        expiryDays?: number;
        lowStock?: boolean;
        scheduleClass?: string;
        supplierId?: string;
        molecule?: string;
        category?: string;
    }): Promise<StockBatch[]>;
    getBatchesForMedicine(medicineId: string, tenantId: string): Promise<StockBatch[]>;
    addPurchase(dto: AddPurchaseDto, user: UserContext): Promise<any[]>;
    adjustStock(dto: AdjustStockDto, user: UserContext): Promise<StockAdjustment>;
    getLowStockAlerts(tenantId: string, threshold?: number): Promise<StockBatch[]>;
    getNearExpiryAlerts(tenantId: string, days?: number): Promise<StockBatch[]>;
    getSuppliers(tenantId: string): Promise<Supplier[]>;
    createSupplier(data: {
        name: string;
        phone?: string;
        gstin?: string;
        address?: string;
    }, user: UserContext): Promise<Supplier>;
    getBestBatch(medicineId: string, tenantId: string): Promise<StockBatch>;
}
