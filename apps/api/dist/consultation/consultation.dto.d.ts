export declare class CreateConsultationDto {
    queue_id: string;
    patient_id: string;
    symptoms?: string;
    examination?: string;
    diagnosis: string;
    diagnosis_code?: string;
    advice?: string;
    follow_up_date?: string;
    referral?: string;
    is_follow_up?: boolean;
}
export declare class UpdateConsultationDto {
    symptoms?: string;
    examination?: string;
    diagnosis?: string;
    diagnosis_code?: string;
    advice?: string;
    follow_up_date?: string;
    referral?: string;
}
export declare class PrescriptionItemDto {
    medicine_id?: string;
    medicine_name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity?: number;
    instructions?: string;
}
export declare class CreatePrescriptionDto {
    consultation_id: string;
    patient_id: string;
    notes?: string;
    items: PrescriptionItemDto[];
}
