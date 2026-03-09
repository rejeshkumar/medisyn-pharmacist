import { Response } from 'express';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    getDashboard(req: any): Promise<{
        today_sales: number;
        today_bill_count: number;
        low_stock_count: number;
        near_expiry_count: number;
        top_medicines: any[];
    }>;
    getDailySales(req: any, date?: string): Promise<{
        date: string;
        total: number;
        sales: import("../database/entities/sale.entity").Sale[];
    }>;
    getPeriodSales(req: any, from: string, to: string): Promise<import("../database/entities/sale.entity").Sale[]>;
    getTopMedicines(req: any, from?: string, to?: string): Promise<any[]>;
    getLowStock(req: any): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getNearExpiry(req: any, days?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getStockValuation(req: any): Promise<{
        items: {
            purchase_value: number;
            mrp_value: number;
            id: string;
            medicine_id: string;
            medicine: import("../database/entities/medicine.entity").Medicine;
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
    exportSales(req: any, from: string, to: string, res: Response): Promise<void>;
}
