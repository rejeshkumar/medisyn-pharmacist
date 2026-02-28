export declare enum UserRole {
    OWNER = "owner",
    PHARMACIST = "pharmacist",
    ASSISTANT = "assistant"
}
export declare enum UserStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}
export declare class User {
    id: string;
    full_name: string;
    mobile: string;
    password_hash: string;
    role: UserRole;
    status: UserStatus;
    created_at: Date;
    updated_at: Date;
}
