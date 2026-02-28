import { Patient } from './patient.entity';
import { User } from './user.entity';
export declare enum ReminderType {
    APPOINTMENT = "appointment",
    MEDICATION = "medication",
    FOLLOW_UP = "follow_up",
    VIP_RENEWAL = "vip_renewal",
    GENERAL = "general"
}
export declare class PatientReminder {
    id: string;
    patient_id: string;
    patient: Patient;
    appointment_id: string;
    title: string;
    message: string;
    remind_at: Date;
    type: ReminderType;
    is_done: boolean;
    created_by: string;
    creator: User;
    created_at: Date;
}
