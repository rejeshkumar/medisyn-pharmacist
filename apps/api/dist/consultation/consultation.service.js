"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const consultation_entity_1 = require("./consultation.entity");
const prescription_entity_1 = require("./prescription.entity");
const prescription_item_entity_1 = require("./prescription-item.entity");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
const queue_service_1 = require("../queue/queue.service");
const queue_entity_1 = require("../queue/queue.entity");
let ConsultationService = class ConsultationService {
    constructor(consultationRepo, prescriptionRepo, prescriptionItemRepo, auditService, queueService) {
        this.consultationRepo = consultationRepo;
        this.prescriptionRepo = prescriptionRepo;
        this.prescriptionItemRepo = prescriptionItemRepo;
        this.auditService = auditService;
        this.queueService = queueService;
    }
    async generatePrescriptionNo(tenantId) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        const count = await this.prescriptionRepo
            .createQueryBuilder('p')
            .where('p.tenant_id = :tenantId', { tenantId })
            .andWhere('DATE(p.issued_at) = CURRENT_DATE')
            .getCount();
        const seq = String(count + 1).padStart(3, '0');
        return `RX-${dateStr}-${seq}`;
    }
    async startConsultation(dto, tenantId, user) {
        const consultation = this.consultationRepo.create({
            tenant_id: tenantId,
            queue_id: dto.queue_id,
            patient_id: dto.patient_id,
            doctor_id: user.id,
            symptoms: dto.symptoms,
            examination: dto.examination,
            diagnosis: dto.diagnosis,
            diagnosis_code: dto.diagnosis_code,
            advice: dto.advice,
            follow_up_date: dto.follow_up_date,
            referral: dto.referral,
            is_follow_up: dto.is_follow_up ?? false,
            started_at: new Date(),
            created_by: user.id,
            updated_by: user.id,
        });
        const saved = await this.consultationRepo.save(consultation);
        await this.queueService.updateStatus(dto.queue_id, { status: queue_entity_1.QueueStatus.IN_CONSULTATION, doctor_id: user.id }, tenantId, user);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'consultations',
            entityId: saved.id,
            newValue: { patient_id: dto.patient_id, queue_id: dto.queue_id },
        });
        return saved;
    }
    async completeConsultation(id, dto, tenantId, user) {
        const consultation = await this.getById(id, tenantId);
        Object.assign(consultation, {
            ...dto,
            completed_at: new Date(),
            updated_by: user.id,
        });
        const saved = await this.consultationRepo.save(consultation);
        await this.queueService.updateStatus(consultation.queue_id, { status: queue_entity_1.QueueStatus.CONSULTATION_DONE }, tenantId, user);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.UPDATE,
            entity: 'consultations',
            entityId: id,
            newValue: { completed_at: saved.completed_at },
        });
        return saved;
    }
    async getById(id, tenantId) {
        const consultation = await this.consultationRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.patient', 'patient')
            .leftJoinAndSelect('c.doctor', 'doctor')
            .leftJoinAndSelect('c.queue', 'queue')
            .where('c.id = :id', { id })
            .andWhere('c.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!consultation)
            throw new common_1.NotFoundException('Consultation not found');
        return consultation;
    }
    async getByQueue(queueId, tenantId) {
        const consultation = await this.consultationRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.patient', 'patient')
            .leftJoinAndSelect('c.doctor', 'doctor')
            .where('c.queue_id = :queueId', { queueId })
            .andWhere('c.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!consultation)
            throw new common_1.NotFoundException('Consultation not found for this queue');
        return consultation;
    }
    async getByPatient(patientId, tenantId) {
        return this.consultationRepo
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.doctor', 'doctor')
            .where('c.patient_id = :patientId', { patientId })
            .andWhere('c.tenant_id = :tenantId', { tenantId })
            .andWhere('c.is_active = true')
            .orderBy('c.created_at', 'DESC')
            .getMany();
    }
    async createPrescription(dto, tenantId, user) {
        const consultation = await this.getById(dto.consultation_id, tenantId);
        const prescriptionNo = await this.generatePrescriptionNo(tenantId);
        const prescription = this.prescriptionRepo.create({
            tenant_id: tenantId,
            consultation_id: dto.consultation_id,
            patient_id: dto.patient_id,
            doctor_id: user.id,
            prescription_no: prescriptionNo,
            status: prescription_entity_1.PrescriptionStatus.ISSUED,
            notes: dto.notes,
            issued_at: new Date(),
            created_by: user.id,
            updated_by: user.id,
            items: dto.items.map(item => this.prescriptionItemRepo.create({
                tenant_id: tenantId,
                medicine_id: item.medicine_id ?? null,
                medicine_name: item.medicine_name,
                dosage: item.dosage,
                frequency: item.frequency,
                duration: item.duration,
                quantity: item.quantity,
                instructions: item.instructions,
                created_by: user.id,
                updated_by: user.id,
            })),
        });
        const saved = await this.prescriptionRepo.save(prescription);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'prescriptions',
            entityId: saved.id,
            newValue: {
                prescription_no: prescriptionNo,
                patient_id: dto.patient_id,
                items_count: dto.items.length,
            },
        });
        return saved;
    }
    async getPrescriptionById(id, tenantId) {
        const prescription = await this.prescriptionRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.patient', 'patient')
            .leftJoinAndSelect('p.doctor', 'doctor')
            .leftJoinAndSelect('p.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .where('p.id = :id', { id })
            .andWhere('p.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!prescription)
            throw new common_1.NotFoundException('Prescription not found');
        return prescription;
    }
    async getPrescriptionsByPatient(patientId, tenantId) {
        return this.prescriptionRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.doctor', 'doctor')
            .leftJoinAndSelect('p.items', 'items')
            .where('p.patient_id = :patientId', { patientId })
            .andWhere('p.tenant_id = :tenantId', { tenantId })
            .andWhere('p.is_active = true')
            .orderBy('p.issued_at', 'DESC')
            .getMany();
    }
    async getPrescriptionByConsultation(consultationId, tenantId) {
        const prescription = await this.prescriptionRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.patient', 'patient')
            .leftJoinAndSelect('p.doctor', 'doctor')
            .leftJoinAndSelect('p.items', 'items')
            .leftJoinAndSelect('items.medicine', 'medicine')
            .where('p.consultation_id = :consultationId', { consultationId })
            .andWhere('p.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!prescription)
            throw new common_1.NotFoundException('Prescription not found for this consultation');
        return prescription;
    }
    async markDispensed(id, saleId, tenantId, user) {
        const prescription = await this.getPrescriptionById(id, tenantId);
        prescription.status = prescription_entity_1.PrescriptionStatus.FULLY_DISPENSED;
        prescription.sale_id = saleId;
        prescription.dispensed_at = new Date();
        prescription.updated_by = user.id;
        const saved = await this.prescriptionRepo.save(prescription);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.DISPENSE,
            entity: 'prescriptions',
            entityId: id,
            newValue: { status: prescription_entity_1.PrescriptionStatus.FULLY_DISPENSED, sale_id: saleId },
        });
        return saved;
    }
};
exports.ConsultationService = ConsultationService;
exports.ConsultationService = ConsultationService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(consultation_entity_1.Consultation)),
    __param(1, (0, typeorm_1.InjectRepository)(prescription_entity_1.Prescription)),
    __param(2, (0, typeorm_1.InjectRepository)(prescription_item_entity_1.PrescriptionItem)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService,
        queue_service_1.QueueService])
], ConsultationService);
//# sourceMappingURL=consultation.service.js.map