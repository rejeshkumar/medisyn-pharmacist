import { StockBatch } from './stock-batch.entity';
export declare class Supplier {
    id: string;
    name: string;
    phone: string;
    gstin: string;
    address: string;
    is_active: boolean;
    batches: StockBatch[];
    tenant_id: string;
    created_by: string;
    updated_by: string;
    created_at: Date;
}
