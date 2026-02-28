import { User } from './user.entity';
import { PatientAppointment } from './patient-appointment.entity';
import { PatientReminder } from './patient-reminder.entity';
export declare enum Salutation {
    MR = "Mr",
    MRS = "Mrs",
    MS = "Ms",
    DR = "Dr",
    BABY = "Baby",
    OTHER = "Other"
}
export declare enum Gender {
    MALE = "male",
    FEMALE = "female",
    OTHER = "other"
}
export declare enum PatientCategory {
    GENERAL = "general",
    INSURANCE = "insurance",
    CORPORATE = "corporate",
    SENIOR = "senior"
}
export declare class Patient {
    id: string;
    uhid: string;
    salutation: Salutation;
    first_name: string;
    last_name: string;
    gender: Gender;
    dob: string;
    age: number;
    mobile: string;
    email: string;
    area: string;
    address: string;
    category: PatientCategory;
    ref_by: string;
    residence_number: string;
    profile_photo_url: string;
    is_first_visit: boolean;
    notes: string;
    is_vip: boolean;
    vip_start_date: string;
    vip_end_date: string;
    vip_registered_by: string;
    is_active: boolean;
    created_by: string;
    creator: User;
    appointments: PatientAppointment[];
    reminders: PatientReminder[];
    created_at: Date;
    updated_at: Date;
}
