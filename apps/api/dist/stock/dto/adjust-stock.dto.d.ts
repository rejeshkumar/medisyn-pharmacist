import { AdjustmentType } from '../../database/entities/stock-adjustment.entity';
export declare class AdjustStockDto {
    batch_id: string;
    quantity: number;
    adjustment_type: AdjustmentType;
    notes?: string;
}
