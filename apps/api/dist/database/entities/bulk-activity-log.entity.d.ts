import { User } from './user.entity';
export declare enum BulkActionType {
    BULK_IMPORT_MEDICINE = "bulk_import_medicine",
    BULK_IMPORT_STOCK = "bulk_import_stock",
    BULK_MODIFY_MEDICINE = "bulk_modify_medicine",
    BULK_MODIFY_STOCK = "bulk_modify_stock"
}
export declare class BulkActivityLog {
    id: string;
    action_type: BulkActionType;
    file_name: string;
    total_rows: number;
    success_rows: number;
    failed_rows: number;
    performed_by: string;
    user: User;
    error_file_url: string;
    created_at: Date;
}
