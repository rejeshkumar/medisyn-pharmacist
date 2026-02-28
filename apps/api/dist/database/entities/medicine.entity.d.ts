import { StockBatch } from './stock-batch.entity';
export declare enum ScheduleClass {
    OTC = "OTC",
    H = "H",
    H1 = "H1",
    X = "X"
}
export declare enum DosageForm {
    TABLET = "Tablet",
    CAPSULE = "Capsule",
    SYRUP = "Syrup",
    INJECTION = "Injection",
    VIAL = "Vial",
    SUSPENSION = "Suspension",
    DROPS = "Drops",
    POWDER = "Powder",
    GEL = "Gel",
    LIQUID = "Liquid",
    LOTION = "Lotion",
    CREAM = "Cream",
    EYE_DROPS = "Eye Drops",
    OINTMENT = "Ointment",
    SOAP = "Soap",
    INHALER = "Inhaler",
    PILL = "Pill",
    PATCH = "Patch",
    OTHER = "Other"
}
export declare enum RxUnit {
    UNITS = "units",
    TSP = "tsp",
    ML = "ml",
    DROPS = "drps",
    PUFF = "puff",
    MG = "mg",
    MCG = "\u03BCg",
    G = "g"
}
export declare enum IntakeRoute {
    ORAL = "Oral",
    TOPICAL = "Topical",
    PARENTERAL = "Parenteral",
    OPHTHALMIC = "Ophthalmic",
    OTIC = "Otic",
    NASAL = "Nasal",
    INHALATION = "Inhalation",
    SUBLINGUAL = "Sublingual",
    RECTAL = "Rectal",
    TRANSDERMAL = "Transdermal"
}
export declare class Medicine {
    id: string;
    brand_name: string;
    molecule: string;
    strength: string;
    dosage_form: string;
    schedule_class: ScheduleClass;
    substitute_group_key: string;
    gst_percent: number;
    mrp: number;
    sale_rate: number;
    manufacturer: string;
    category: string;
    rx_units: string;
    stock_group: string;
    treatment_for: string;
    description: string;
    discount_percent: number;
    rack_location: string;
    intake_route: string;
    reorder_qty: number;
    is_rx_required: boolean;
    is_active: boolean;
    batches: StockBatch[];
    created_at: Date;
    updated_at: Date;
}
