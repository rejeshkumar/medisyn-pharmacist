import { Repository } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';
export declare class ReportsService {
    private saleRepo;
    private saleItemRepo;
    private batchRepo;
    private medicineRepo;
    constructor(saleRepo: Repository<Sale>, saleItemRepo: Repository<SaleItem>, batchRepo: Repository<StockBatch>, medicineRepo: Repository<Medicine>);
    getDashboard(tenantId: string): Promise<{
        today_sales: number;
        today_bill_count: number;
        low_stock_count: number;
        near_expiry_count: number;
        top_medicines: any[];
    }>;
    getDailySales(tenantId: string, date?: string): Promise<{
        date: string;
        total: number;
        sales: Sale[];
    }>;
    getPeriodSales(tenantId: string, from: string, to: string): Promise<Sale[]>;
    getTopMedicines(tenantId: string, from?: string, to?: string): Promise<any[]>;
    getLowStockReport(tenantId: string): Promise<StockBatch[]>;
    getNearExpiryReport(tenantId: string, days?: number): Promise<StockBatch[]>;
    getStockValuation(tenantId: string): Promise<{
        items: {
            purchase_value: number;
            mrp_value: number;
            id: string;
            medicine_id: string;
            medicine: Medicine;
            batch_number: string;
            expiry_date: Date;
            quantity: number;
            purchase_price: number;
            mrp: number;
            sale_rate: number;
            supplier_id: string;
            supplier: import("../database/entities/supplier.entity").Supplier;
            purchase_invoice_no: string;
            notes: string;
            is_active: boolean;
            tenant_id: string;
            created_by: string;
            updated_by: string;
            created_at: Date;
            updated_at: Date;
        }[];
        total_purchase_value: number;
        total_mrp_value: number;
        potential_profit: number;
    }>;
    exportSalesToExcel(tenantId: string, from: string, to: string): Promise<Buffer>;
}
