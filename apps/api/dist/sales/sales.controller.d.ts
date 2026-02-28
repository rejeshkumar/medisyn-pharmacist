import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
export declare class SalesController {
    private salesService;
    constructor(salesService: SalesService);
    create(dto: CreateSaleDto, req: any): Promise<import("../database/entities/sale.entity").Sale>;
    findAll(from?: string, to?: string, search?: string): Promise<import("../database/entities/sale.entity").Sale[]>;
    findByBillNumber(billNumber: string): Promise<import("../database/entities/sale.entity").Sale>;
    findOne(id: string): Promise<import("../database/entities/sale.entity").Sale>;
    void(id: string, body: {
        reason: string;
    }, req: any): Promise<{
        message: string;
    }>;
}
