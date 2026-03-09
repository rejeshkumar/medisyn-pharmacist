import { AiPrescriptionService } from './ai-prescription.service';
export declare class AiPrescriptionController {
    private aiService;
    constructor(aiService: AiPrescriptionService);
    parse(file: Express.Multer.File, req: any): Promise<{
        id: string;
        image_url: string;
        status: import("../database/entities/ai-prescription.entity").ExtractionStatus;
    }>;
    findAll(req: any): Promise<import("../database/entities/ai-prescription.entity").AiPrescription[]>;
    findOne(id: string): Promise<import("../database/entities/ai-prescription.entity").AiPrescription>;
    finalize(id: string, body: {
        medicines: any[];
    }): Promise<import("../database/entities/ai-prescription.entity").AiPrescription>;
}
