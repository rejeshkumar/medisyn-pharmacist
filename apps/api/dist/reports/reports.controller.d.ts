import { Response } from 'express';
import { ReportsService } from './reports.service';
export declare class ReportsController {
    private reportsService;
    constructor(reportsService: ReportsService);
    getDashboard(): Promise<{
        today_sales: number;
        today_bill_count: number;
        low_stock_count: number;
        near_expiry_count: number;
        top_medicines: any[];
    }>;
    getDailySales(date?: string): Promise<{
        date: string;
        total: number;
        sales: import("../database/entities/sale.entity").Sale[];
    }>;
    getPeriodSales(from: string, to: string): Promise<import("../database/entities/sale.entity").Sale[]>;
    getTopMedicines(from?: string, to?: string): Promise<any[]>;
    getLowStock(): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getNearExpiry(days?: number): Promise<import("../database/entities/stock-batch.entity").StockBatch[]>;
    getStockValuation(): Promise<{
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
            created_at: Date;
            updated_at: Date;
        }[];
        total_purchase_value: number;
        total_mrp_value: number;
        potential_profit: number;
    }>;
    exportSales(from: string, to: string, res: Response): Promise<void>;
}
