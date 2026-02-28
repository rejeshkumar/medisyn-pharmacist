import { User } from './user.entity';
export declare enum ExtractionStatus {
    PENDING = "pending",
    PROCESSING = "processing",
    COMPLETED = "completed",
    FAILED = "failed"
}
export declare class AiPrescription {
    id: string;
    sale_id: string;
    uploaded_by: string;
    uploader: User;
    image_url: string;
    extraction_json: any;
    patient_name: string;
    doctor_name: string;
    confidence_summary: string;
    status: ExtractionStatus;
    error_message: string;
    created_at: Date;
}
