import { User } from './user.entity';
import { SaleItem } from './sale-item.entity';
export declare enum PaymentMode {
    CASH = "cash",
    CARD = "card",
    UPI = "upi"
}
export declare class Sale {
    id: string;
    bill_number: string;
    customer_name: string;
    doctor_name: string;
    doctor_reg_no: string;
    subtotal: number;
    discount_amount: number;
    discount_percent: number;
    tax_amount: number;
    total_amount: number;
    payment_mode: PaymentMode;
    prescription_image_url: string;
    ai_prescription_id: string;
    notes: string;
    has_scheduled_drugs: boolean;
    is_voided: boolean;
    voided_by: string;
    voided_reason: string;
    created_by: string;
    pharmacist: User;
    items: SaleItem[];
    created_at: Date;
}
