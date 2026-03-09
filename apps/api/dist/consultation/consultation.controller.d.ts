import { ConsultationService } from './consultation.service';
import { CreateConsultationDto, UpdateConsultationDto, CreatePrescriptionDto } from './consultation.dto';
export declare class ConsultationController {
    private readonly consultationService;
    constructor(consultationService: ConsultationService);
    start(dto: CreateConsultationDto, req: any): Promise<import("./consultation.entity").Consultation>;
    getById(id: string, req: any): Promise<import("./consultation.entity").Consultation>;
    getByQueue(queueId: string, req: any): Promise<import("./consultation.entity").Consultation>;
    getByPatient(patientId: string, req: any): Promise<import("./consultation.entity").Consultation[]>;
    complete(id: string, dto: UpdateConsultationDto, req: any): Promise<import("./consultation.entity").Consultation>;
}
export declare class PrescriptionController {
    private readonly consultationService;
    constructor(consultationService: ConsultationService);
    create(dto: CreatePrescriptionDto, req: any): Promise<import("./prescription.entity").Prescription>;
    getById(id: string, req: any): Promise<import("./prescription.entity").Prescription>;
    getByPatient(patientId: string, req: any): Promise<import("./prescription.entity").Prescription[]>;
    getByConsultation(consultationId: string, req: any): Promise<import("./prescription.entity").Prescription>;
    markDispensed(id: string, body: {
        sale_id: string;
    }, req: any): Promise<import("./prescription.entity").Prescription>;
}
