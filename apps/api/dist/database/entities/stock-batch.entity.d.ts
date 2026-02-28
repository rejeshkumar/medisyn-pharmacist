import { Medicine } from './medicine.entity';
import { Supplier } from './supplier.entity';
export declare class StockBatch {
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
    supplier: Supplier;
    purchase_invoice_no: string;
    notes: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}
