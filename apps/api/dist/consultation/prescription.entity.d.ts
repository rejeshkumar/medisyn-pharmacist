import { Tenant } from '../database/entities/tenant.entity';
import { User } from '../database/entities/user.entity';
import { Patient } from '../database/entities/patient.entity';
import { Consultation } from './consultation.entity';
import { PrescriptionItem } from './prescription-item.entity';
export declare enum PrescriptionStatus {
    DRAFT = "draft",
    ISSUED = "issued",
    PARTIALLY_DISPENSED = "partially_dispensed",
    FULLY_DISPENSED = "fully_dispensed",
    CANCELLED = "cancelled"
}
export declare class Prescription {
    id: string;
    tenant_id: string;
    tenant: Tenant;
    consultation_id: string;
    consultation: Consultation;
    patient_id: string;
    patient: Patient;
    doctor_id: string;
    doctor: User;
    prescription_no: string;
    status: PrescriptionStatus;
    sale_id: string;
    notes: string;
    issued_at: Date;
    dispensed_at: Date;
    items: PrescriptionItem[];
    is_active: boolean;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}
