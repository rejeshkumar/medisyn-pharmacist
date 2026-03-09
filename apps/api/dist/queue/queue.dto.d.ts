import { ConsultationType } from './queue.entity';
export declare class CreateQueueDto {
    patient_id: string;
    doctor_id?: string;
    visit_type?: ConsultationType;
    chief_complaint?: string;
    notes?: string;
}
export declare class UpdateQueueStatusDto {
    status: string;
    doctor_id?: string;
}
export declare class RecordPreCheckDto {
    queue_id: string;
    bp_systolic?: number;
    bp_diastolic?: number;
    pulse_rate?: number;
    temperature?: number;
    weight?: number;
    height?: number;
    spo2?: number;
    blood_sugar?: number;
    chief_complaint?: string;
    allergies?: string;
    current_medicines?: string;
    notes?: string;
}
