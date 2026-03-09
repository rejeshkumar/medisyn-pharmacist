import { Tenant } from './tenant.entity';
export declare enum UserRole {
    OWNER = "owner",
    PHARMACIST = "pharmacist",
    ASSISTANT = "assistant",
    DOCTOR = "doctor"
}
export declare enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}
export declare class User {
    id: string;
    tenant_id: string;
    tenant: Tenant;
    full_name: string;
    mobile: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    created_by: string;
    updated_by: string;
    created_at: Date;
    updated_at: Date;
}
