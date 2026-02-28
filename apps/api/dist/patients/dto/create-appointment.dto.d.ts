import { AppointmentType, AppointmentStatus } from '../../database/entities/patient-appointment.entity';
export declare class CreateAppointmentDto {
    appointment_date: string;
    appointment_time?: string;
    type?: AppointmentType;
    doctor_name?: string;
    notes?: string;
}
export declare class UpdateAppointmentDto {
    status?: AppointmentStatus;
    notes?: string;
    cancellation_reason?: string;
    appointment_date?: string;
    appointment_time?: string;
}
