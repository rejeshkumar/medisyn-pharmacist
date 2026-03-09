export declare enum TenantMode {
    PHARMACY = "pharmacy",
    CLINIC = "clinic",
    FULL = "full"
}
export declare enum TenantPlan {
    TRIAL = "trial",
    BASIC = "basic",
    PRO = "pro"
}
export declare class Tenant {
    id: string;
    name: string;
    slug: string;
    mode: TenantMode;
    plan: TenantPlan;
    phone: string;
    address: string;
    logo_url: string;
    gstin: string;
    license_no: string;
    is_active: boolean;
    trial_ends_at: Date;
    created_at: Date;
}
