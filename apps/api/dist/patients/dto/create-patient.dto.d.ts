import { Salutation, Gender, PatientCategory } from '../../database/entities/patient.entity';
export declare class CreatePatientDto {
    salutation?: Salutation;
    first_name: string;
    last_name?: string;
    gender?: Gender;
    dob?: string;
    age?: number;
    mobile: string;
    email?: string;
    area?: string;
    address?: string;
    category?: PatientCategory;
    ref_by?: string;
    residence_number?: string;
    is_first_visit?: boolean;
    notes?: string;
    is_vip?: boolean;
    vip_start_date?: string;
    vip_end_date?: string;
}
export declare class VipRegisterDto {
    salutation?: Salutation;
    first_name: string;
    last_name?: string;
    mobile: string;
    gender?: Gender;
    dob?: string;
    email?: string;
    area?: string;
    address?: string;
    vip_registered_by?: string;
}
