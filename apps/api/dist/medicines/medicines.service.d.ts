import { Repository } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class MedicinesService {
    private medicinesRepo;
    private batchRepo;
    private auditService;
    constructor(medicinesRepo: Repository<Medicine>, batchRepo: Repository<StockBatch>, auditService: AuditService);
    findAll(tenantId: string, search?: string, category?: string, scheduleClass?: string): Promise<Medicine[]>;
    findOne(id: string, tenantId: string): Promise<Medicine>;
    create(dto: CreateMedicineDto, user: UserContext): Promise<Medicine>;
    update(id: string, dto: UpdateMedicineDto, user: UserContext): Promise<Medicine>;
    deactivate(id: string, user: UserContext): Promise<Medicine>;
    getSubstitutes(id: string, tenantId: string): Promise<any[]>;
    getWithStock(tenantId: string): Promise<Medicine[]>;
}
