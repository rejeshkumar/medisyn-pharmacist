import { ReminderType } from '../../database/entities/patient-reminder.entity';
export declare class CreateReminderDto {
    title: string;
    message?: string;
    remind_at: string;
    type?: ReminderType;
    appointment_id?: string;
}
