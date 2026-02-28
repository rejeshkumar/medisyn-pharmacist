import { User } from './user.entity';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';
export declare class ScheduleDrugLog {
    id: string;
    sale_id: string;
    sale: Sale;
    sale_item_id: string;
    sale_item: SaleItem;
    patient_name: string;
    doctor_name: string;
    doctor_reg_no: string;
    prescription_image_url: string;
    medicine_name: string;
    schedule_class: string;
    quantity_dispensed: number;
    batch_number: string;
    pharmacist_id: string;
    pharmacist: User;
    is_substituted: boolean;
    substitution_reason: string;
    created_at: Date;
}
