export declare class PurchaseItemDto {
    medicine_id: string;
    batch_number: string;
    expiry_date: string;
    quantity: number;
    purchase_price: number;
    mrp: number;
    sale_rate?: number;
    notes?: string;
}
export declare class AddPurchaseDto {
    supplier_id?: string;
    invoice_no?: string;
    items: PurchaseItemDto[];
}
