import { Repository } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
export declare class SubstitutesService {
    private medicineRepo;
    private batchRepo;
    constructor(medicineRepo: Repository<Medicine>, batchRepo: Repository<StockBatch>);
    getSubstitutes(medicineId: string): Promise<any[]>;
}
