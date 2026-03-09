import { StockService } from './stock.service';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
export declare class StockController {
    private stockService;
    constructor(stockService: StockService);
    getStockList(req: any, search?: string, expiryDays?: number, lowStock?: boolean, scheduleClass?: string, supplierId?: string, molecule?: string, category?: string): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getLowStockAlerts(req: any, threshold?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getNearExpiryAlerts(req: any, days?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getSuppliers(req: any): Promise<import("../database/entities/supplier.entity").Supplier[]>;
    createSupplier(dto: CreateSupplierDto, req: any): Promise<import("../database/entities/supplier.entity").Supplier>;
    getBatches(medicineId: string, req: any): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getBestBatch(medicineId: string, req: any): Promise<import("../database/entities/stock-batch.entity").StockBatch>;
    addPurchase(dto: AddPurchaseDto, req: any): Promise<any[]>;
    adjustStock(dto: AdjustStockDto, req: any): Promise<import("../database/entities/stock-adjustment.entity").StockAdjustment>;
}
