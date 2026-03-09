import { Repository } from 'typeorm';
import { BulkActivityLog } from '../database/entities/bulk-activity-log.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Supplier } from '../database/entities/supplier.entity';
export declare class BulkService {
    private logRepo;
    private medicineRepo;
    private batchRepo;
    private supplierRepo;
    constructor(logRepo: Repository<BulkActivityLog>, medicineRepo: Repository<Medicine>, batchRepo: Repository<StockBatch>, supplierRepo: Repository<Supplier>);
    importMedicines(filePath: string, fileName: string, userId: string): Promise<{
        success: boolean;
        errors: {
            row: number;
            error: string;
            data: any;
        }[];
        message: string;
        total_rows?: undefined;
        success_rows?: undefined;
        failed_rows?: undefined;
    } | {
        success: boolean;
        total_rows: number;
        success_rows: number;
        failed_rows: number;
        message: string;
        errors?: undefined;
    }>;
    importStock(filePath: string, fileName: string, userId: string): Promise<{
        success: boolean;
        errors: any[];
        total_rows?: undefined;
        success_rows?: undefined;
        failed_rows?: undefined;
    } | {
        success: boolean;
        total_rows: number;
        success_rows: number;
        failed_rows: number;
        errors?: undefined;
    }>;
    getLogs(userId?: string): Promise<BulkActivityLog[]>;
    getMedicineTemplate(): Promise<Buffer>;
    getStockTemplate(): Promise<Buffer>;
    parseInvoicePdf(filePath: string): Promise<{
        supplier: string;
        invoiceNo: string;
        invoiceDate: string;
        items: Array<{
            medicineName: string;
            batchNo: string;
            expiry: string;
            qty: number;
            purchasePrice: number;
            mrp: number;
            gstPercent: number;
        }>;
    }>;
    private extractSupplierName;
    private extractInvoiceNo;
    private extractInvoiceDate;
    private extractInvoiceItems;
    importInvoiceItems(items: Array<{
        medicineName: string;
        batchNo: string;
        expiry: string;
        qty: number;
        purchasePrice: number;
        mrp: number;
        gstPercent: number;
    }>, supplierName: string, invoiceNo: string, userId: string): Promise<{
        success: boolean;
        total_rows: number;
        success_rows: number;
        failed_rows: number;
        errors: string[];
    }>;
    private logActivity;
}
