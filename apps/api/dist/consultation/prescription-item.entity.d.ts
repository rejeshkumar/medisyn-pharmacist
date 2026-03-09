import { Tenant } from '../database/entities/tenant.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { Prescription } from './prescription.entity';
export declare class PrescriptionItem {
    id: string;
    tenant_id: string;
    tenant: Tenant;
    prescription_id: string;
    prescription: Prescription;
    medicine_id: string;
    medicine: Medicine;
    medicine_name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string;
    is_dispensed: boolean;
    is_active: boolean;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}
