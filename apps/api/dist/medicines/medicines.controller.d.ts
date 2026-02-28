import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
export declare class MedicinesController {
    private medicinesService;
    constructor(medicinesService: MedicinesService);
    findAll(search?: string, category?: string, scheduleClass?: string): Promise<import("../database/entities/medicine.entity").Medicine[]>;
    getWithStock(): Promise<import("../database/entities/medicine.entity").Medicine[]>;
    findOne(id: string): Promise<import("../database/entities/medicine.entity").Medicine>;
    getSubstitutes(id: string): Promise<any[]>;
    create(dto: CreateMedicineDto): Promise<import("../database/entities/medicine.entity").Medicine>;
    update(id: string, dto: UpdateMedicineDto): Promise<import("../database/entities/medicine.entity").Medicine>;
    deactivate(id: string): Promise<import("../database/entities/medicine.entity").Medicine>;
}
