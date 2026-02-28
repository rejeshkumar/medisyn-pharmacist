import { Repository } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
export declare class MedicinesService {
    private medicinesRepo;
    private batchRepo;
    constructor(medicinesRepo: Repository<Medicine>, batchRepo: Repository<StockBatch>);
    findAll(search?: string, category?: string, scheduleClass?: string): Promise<Medicine[]>;
    findOne(id: string): Promise<Medicine>;
    create(dto: CreateMedicineDto): Promise<Medicine>;
    update(id: string, dto: UpdateMedicineDto): Promise<Medicine>;
    deactivate(id: string): Promise<Medicine>;
    getSubstitutes(id: string): Promise<any[]>;
    getWithStock(): Promise<Medicine[]>;
}
