import { PaymentMode } from '../../database/entities/sale.entity';
export declare class SaleItemDto {
    medicine_id: string;
    batch_id: string;
    qty: number;
    rate?: number;
    gst_percent?: number;
    is_substituted?: boolean;
    original_medicine_id?: string;
    substitution_reason?: string;
}
export declare class ComplianceDataDto {
    patient_name: string;
    doctor_name: string;
    doctor_reg_no?: string;
}
export declare class CreateSaleDto {
    customer_name?: string;
    doctor_name?: string;
    doctor_reg_no?: string;
    items: SaleItemDto[];
    discount_amount?: number;
    discount_percent?: number;
    payment_mode: PaymentMode;
    prescription_image_url?: string;
    ai_prescription_id?: string;
    notes?: string;
    compliance_data?: ComplianceDataDto;
}
