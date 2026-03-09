import { Repository } from 'typeorm';
import { Consultation } from './consultation.entity';
import { Prescription } from './prescription.entity';
import { PrescriptionItem } from './prescription-item.entity';
import { CreateConsultationDto, UpdateConsultationDto, CreatePrescriptionDto } from './consultation.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
import { QueueService } from '../queue/queue.service';
export declare class ConsultationService {
    private consultationRepo;
    private prescriptionRepo;
    private prescriptionItemRepo;
    private auditService;
    private queueService;
    constructor(consultationRepo: Repository<Consultation>, prescriptionRepo: Repository<Prescription>, prescriptionItemRepo: Repository<PrescriptionItem>, auditService: AuditService, queueService: QueueService);
    private generatePrescriptionNo;
    startConsultation(dto: CreateConsultationDto, tenantId: string, user: UserContext): Promise<Consultation>;
    completeConsultation(id: string, dto: UpdateConsultationDto, tenantId: string, user: UserContext): Promise<Consultation>;
    getById(id: string, tenantId: string): Promise<Consultation>;
    getByQueue(queueId: string, tenantId: string): Promise<Consultation>;
    getByPatient(patientId: string, tenantId: string): Promise<Consultation[]>;
    createPrescription(dto: CreatePrescriptionDto, tenantId: string, user: UserContext): Promise<Prescription>;
    getPrescriptionById(id: string, tenantId: string): Promise<Prescription>;
    getPrescriptionsByPatient(patientId: string, tenantId: string): Promise<Prescription[]>;
    getPrescriptionByConsultation(consultationId: string, tenantId: string): Promise<Prescription>;
    markDispensed(id: string, saleId: string, tenantId: string, user: UserContext): Promise<Prescription>;
}
