import { Patient } from './patient.entity';
import { User } from './user.entity';
export declare enum AppointmentType {
    CONSULTATION = "consultation",
    FOLLOW_UP = "follow_up",
    PHARMACY_VISIT = "pharmacy_visit",
    VACCINATION = "vaccination",
    REVIEW = "review"
}
export declare enum AppointmentStatus {
    SCHEDULED = "scheduled",
    COMPLETED = "completed",
    MISSED = "missed",
    CANCELLED = "cancelled"
}
export declare class PatientAppointment {
    id: string;
    patient_id: string;
    patient: Patient;
    appointment_date: string;
    appointment_time: string;
    type: AppointmentType;
    status: AppointmentStatus;
    doctor_name: string;
    notes: string;
    cancellation_reason: string;
    reminder_sent: boolean;
    created_by: string;
    creator: User;
    created_at: Date;
    updated_at: Date;
}
