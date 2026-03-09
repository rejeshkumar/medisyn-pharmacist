import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
export declare enum QueueStatus {
    WAITING = "waiting",
    IN_PRECHECK = "in_precheck",
    PRECHECK_DONE = "precheck_done",
    IN_CONSULTATION = "in_consultation",
    CONSULTATION_DONE = "consultation_done",
    DISPENSING = "dispensing",
    COMPLETED = "completed",
    CANCELLED = "cancelled",
    NO_SHOW = "no_show"
}
export declare enum ConsultationType {
    NEW = "new",
    FOLLOW_UP = "follow_up",
    EMERGENCY = "emergency"
}
export declare class Queue {
    id: string;
    tenant_id: string;
    tenant: Tenant;
    patient_id: string;
    patient: Patient;
    doctor_id: string;
    doctor: User;
    token_number: number;
    visit_date: string;
    status: QueueStatus;
    visit_type: ConsultationType;
    chief_complaint: string;
    notes: string;
    registered_at: Date;
    called_at: Date;
    completed_at: Date;
    is_active: boolean;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}
