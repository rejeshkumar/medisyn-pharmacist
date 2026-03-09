import { ScheduleClass } from '../../database/entities/medicine.entity';
export declare class CreateMedicineDto {
    brand_name: string;
    molecule: string;
    strength: string;
    dosage_form: string;
    schedule_class: ScheduleClass;
    substitute_group_key?: string;
    gst_percent?: number;
    mrp?: number;
    sale_rate?: number;
    manufacturer?: string;
    category?: string;
    rx_units?: string;
    stock_group?: string;
    treatment_for?: string;
    description?: string;
    discount_percent?: number;
    rack_location?: string;
    intake_route?: string;
    reorder_qty?: number;
    is_rx_required?: boolean;
}
