export declare enum AuditAction {
    CREATE = "CREATE",
    UPDATE = "UPDATE",
    DELETE = "DELETE",
    DISPENSE = "DISPENSE",
    STOCK_IN = "STOCK_IN",
    STOCK_ADJUST = "STOCK_ADJUST",
    VOID = "VOID",
    DEACTIVATE = "DEACTIVATE",
    ACTIVATE = "ACTIVATE",
    PASSWORD_RESET = "PASSWORD_RESET",
    VIEW_SCHEDULE = "VIEW_SCHEDULE",
    EXPORT = "EXPORT"
}
export declare class AuditLog {
    id: string;
    tenant_id: string;
    user_id: string;
    user_name: string;
    user_role: string;
    action: AuditAction;
    entity: string;
    entity_id: string;
    entity_ref: string;
    old_value: Record<string, any>;
    new_value: Record<string, any>;
    ip_address: string;
    created_at: Date;
}
