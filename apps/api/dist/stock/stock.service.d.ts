import { Repository } from 'typeorm';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
export declare class StockService {
    private batchRepo;
    private adjustmentRepo;
    private supplierRepo;
    private medicineRepo;
    constructor(batchRepo: Repository<StockBatch>, adjustmentRepo: Repository<StockAdjustment>, supplierRepo: Repository<Supplier>, medicineRepo: Repository<Medicine>);
    getStockList(filters: {
        search?: string;
        expiryDays?: number;
        lowStock?: boolean;
        scheduleClass?: string;
        supplierId?: string;
        molecule?: string;
        category?: string;
    }): Promise<StockBatch[]>;
    getBatchesForMedicine(medicineId: string): Promise<StockBatch[]>;
    addPurchase(dto: AddPurchaseDto, userId: string): Promise<any[]>;
    adjustStock(dto: AdjustStockDto, userId: string): Promise<StockAdjustment>;
    getLowStockAlerts(threshold?: number): Promise<StockBatch[]>;
    getNearExpiryAlerts(days?: number): Promise<StockBatch[]>;
    getSuppliers(): Promise<Supplier[]>;
    createSupplier(data: {
        name: string;
        phone?: string;
        gstin?: string;
        address?: string;
    }): Promise<Supplier>;
    getBestBatch(medicineId: string): Promise<StockBatch>;
}
