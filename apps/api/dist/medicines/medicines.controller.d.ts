import { MedicinesService } from './medicines.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
export declare class MedicinesController {
    private medicinesService;
    constructor(medicinesService: MedicinesService);
    findAll(req: any, search?: string, category?: string, scheduleClass?: string): Promise<import("../database/entities/medicine.entity").Medicine[]>;
    getWithStock(req: any): Promise<import("../database/entities/medicine.entity").Medicine[]>;
    findOne(id: string, req: any): Promise<import("../database/entities/medicine.entity").Medicine>;
    getSubstitutes(id: string, req: any): Promise<any[]>;
    create(dto: CreateMedicineDto, req: any): Promise<import("../database/entities/medicine.entity").Medicine>;
    update(id: string, dto: UpdateMedicineDto, req: any): Promise<import("../database/entities/medicine.entity").Medicine>;
    deactivate(id: string, req: any): Promise<import("../database/entities/medicine.entity").Medicine>;
}
