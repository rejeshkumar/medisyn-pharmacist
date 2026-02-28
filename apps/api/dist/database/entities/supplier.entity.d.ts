import { StockBatch } from './stock-batch.entity';
export declare class Supplier {
    id: string;
    name: string;
    phone: string;
    gstin: string;
    address: string;
    is_active: boolean;
    batches: StockBatch[];
    created_at: Date;
}
