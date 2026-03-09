import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { AiPrescription, ExtractionStatus } from '../database/entities/ai-prescription.entity';
import { Medicine } from '../database/entities/medicine.entity';
export interface ExtractedMedicine {
    name: string;
    strength?: string;
    dose?: string;
    frequency?: string;
    duration?: string;
    notes?: string;
    confidence: 'high' | 'medium' | 'low';
    matched_medicine_id?: string;
    matched_medicine_name?: string;
}
export declare class AiPrescriptionService {
    private aiRxRepo;
    private medicineRepo;
    private configService;
    private openai;
    constructor(aiRxRepo: Repository<AiPrescription>, medicineRepo: Repository<Medicine>, configService: ConfigService);
    uploadAndParse(file: Express.Multer.File, userId: string): Promise<{
        id: string;
        image_url: string;
        status: ExtractionStatus;
    }>;
    private processAsync;
    private extractWithOpenAI;
    private mockExtraction;
    private mapMedicinesToMaster;
    private computeConfidenceSummary;
    findOne(id: string): Promise<AiPrescription>;
    finalize(id: string, approvedMedicines: any[]): Promise<AiPrescription>;
    findAll(userId?: string): Promise<AiPrescription[]>;
}
