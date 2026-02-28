import { StockBatch } from './stock-batch.entity';
import { User } from './user.entity';
export declare enum AdjustmentType {
    EXPIRED = "expired",
    BREAKAGE = "breakage",
    SAMPLE = "sample",
    CORRECTION = "correction",
    THEFT_LOSS = "theft_loss",
    SUPPLIER_RETURN = "supplier_return"
}
export declare class StockAdjustment {
    id: string;
    batch_id: string;
    batch: StockBatch;
    quantity_change: number;
    quantity_before: number;
    quantity_after: number;
    adjustment_type: AdjustmentType;
    notes: string;
    performed_by: string;
    user: User;
    created_at: Date;
}
