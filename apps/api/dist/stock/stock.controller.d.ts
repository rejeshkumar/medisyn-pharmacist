import { StockService } from './stock.service';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
export declare class StockController {
    private stockService;
    constructor(stockService: StockService);
    getStockList(search?: string, expiryDays?: number, lowStock?: boolean, scheduleClass?: string, supplierId?: string, molecule?: string, category?: string): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getLowStockAlerts(threshold?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getNearExpiryAlerts(days?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getSuppliers(): Promise<import("../database/entities/supplier.entity").Supplier[]>;
    createSupplier(dto: CreateSupplierDto): Promise<import("../database/entities/supplier.entity").Supplier>;
    getBatches(medicineId: string): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getBestBatch(medicineId: string): Promise<import("../database/entities/stock-batch.entity").StockBatch>;
    addPurchase(dto: AddPurchaseDto, req: any): Promise<any[]>;
    adjustStock(dto: AdjustStockDto, req: any): Promise<import("../database/entities/stock-adjustment.entity").StockAdjustment>;
}
