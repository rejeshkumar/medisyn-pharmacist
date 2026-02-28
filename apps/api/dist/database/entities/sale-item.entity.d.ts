import { Sale } from './sale.entity';
import { Medicine } from './medicine.entity';
import { StockBatch } from './stock-batch.entity';
export declare class SaleItem {
    id: string;
    sale_id: string;
    sale: Sale;
    medicine_id: string;
    medicine: Medicine;
    batch_id: string;
    batch: StockBatch;
    qty: number;
    rate: number;
    gst_percent: number;
    item_total: number;
    is_substituted: boolean;
    original_medicine_id: string;
    substitution_reason: string;
    medicine_name: string;
    batch_number: string;
}
