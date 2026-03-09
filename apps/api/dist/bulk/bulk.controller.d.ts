import { Response } from 'express';
import { BulkService } from './bulk.service';
export declare class BulkController {
    private bulkService;
    constructor(bulkService: BulkService);
    getMedicineTemplate(res: Response): Promise<void>;
    getStockTemplate(res: Response): Promise<void>;
    importMedicines(file: Express.Multer.File, req: any): Promise<{
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
    importStock(file: Express.Multer.File, req: any): Promise<{
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
    parseInvoice(file: Express.Multer.File): Promise<{
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
    importInvoice(body: any, req: any): Promise<{
        success: boolean;
        total_rows: number;
        success_rows: number;
        failed_rows: number;
        errors: string[];
    }>;
    getLogs(req: any): Promise<import("../database/entities/bulk-activity-log.entity").BulkActivityLog[]>;
}
