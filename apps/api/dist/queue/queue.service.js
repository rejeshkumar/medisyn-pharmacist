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
exports.QueueService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const queue_entity_1 = require("./queue.entity");
const pre_check_entity_1 = require("./pre-check.entity");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
let QueueService = class QueueService {
    constructor(queueRepo, preCheckRepo, auditService, dataSource) {
        this.queueRepo = queueRepo;
        this.preCheckRepo = preCheckRepo;
        this.auditService = auditService;
        this.dataSource = dataSource;
    }
    async getNextToken(tenantId) {
        const today = new Date().toISOString().split('T')[0];
        const result = await this.queueRepo
            .createQueryBuilder('q')
            .select('MAX(q.token_number)', 'max')
            .where('q.tenant_id = :tenantId', { tenantId })
            .andWhere('q.visit_date = :today', { today })
            .getRawOne();
        return (result?.max ?? 0) + 1;
    }
    async register(dto, tenantId, user) {
        const token = await this.getNextToken(tenantId);
        const today = new Date().toISOString().split('T')[0];
        const queue = this.queueRepo.create({
            tenant_id: tenantId,
            patient_id: dto.patient_id,
            doctor_id: dto.doctor_id ?? null,
            token_number: token,
            visit_date: today,
            visit_type: dto.visit_type,
            chief_complaint: dto.chief_complaint,
            notes: dto.notes,
            status: queue_entity_1.QueueStatus.WAITING,
            created_by: user.id,
            updated_by: user.id,
        });
        const saved = await this.queueRepo.save(queue);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'queues',
            entityId: saved.id,
            newValue: { patient_id: dto.patient_id, token, visit_type: dto.visit_type },
        });
        return saved;
    }
    async getTodayQueue(tenantId, doctorId) {
        const today = new Date().toISOString().split('T')[0];
        const qb = this.queueRepo
            .createQueryBuilder('q')
            .leftJoinAndSelect('q.patient', 'patient')
            .leftJoinAndSelect('q.doctor', 'doctor')
            .where('q.tenant_id = :tenantId', { tenantId })
            .andWhere('q.visit_date = :today', { today })
            .andWhere('q.is_active = true')
            .orderBy('q.token_number', 'ASC');
        if (doctorId) {
            qb.andWhere('q.doctor_id = :doctorId', { doctorId });
        }
        return qb.getMany();
    }
    async getById(id, tenantId) {
        const queue = await this.queueRepo
            .createQueryBuilder('q')
            .leftJoinAndSelect('q.patient', 'patient')
            .leftJoinAndSelect('q.doctor', 'doctor')
            .where('q.id = :id', { id })
            .andWhere('q.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!queue)
            throw new common_1.NotFoundException('Queue entry not found');
        return queue;
    }
    async updateStatus(id, dto, tenantId, user) {
        const queue = await this.getById(id, tenantId);
        const oldStatus = queue.status;
        queue.status = dto.status;
        queue.updated_by = user.id;
        if (dto.doctor_id)
            queue.doctor_id = dto.doctor_id;
        if (dto.status === queue_entity_1.QueueStatus.IN_CONSULTATION)
            queue.called_at = new Date();
        if ([queue_entity_1.QueueStatus.COMPLETED, queue_entity_1.QueueStatus.CANCELLED, queue_entity_1.QueueStatus.NO_SHOW]
            .includes(dto.status)) {
            queue.completed_at = new Date();
        }
        const saved = await this.queueRepo.save(queue);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.UPDATE,
            entity: 'queues',
            entityId: id,
            oldValue: { status: oldStatus },
            newValue: { status: dto.status },
        });
        return saved;
    }
    async getTodayStats(tenantId) {
        const today = new Date().toISOString().split('T')[0];
        const rows = await this.queueRepo
            .createQueryBuilder('q')
            .select('q.status', 'status')
            .addSelect('COUNT(*)', 'count')
            .where('q.tenant_id = :tenantId', { tenantId })
            .andWhere('q.visit_date = :today', { today })
            .andWhere('q.is_active = true')
            .groupBy('q.status')
            .getRawMany();
        const stats = {
            total: 0, waiting: 0, in_precheck: 0, precheck_done: 0,
            in_consultation: 0, consultation_done: 0, completed: 0, cancelled: 0,
        };
        rows.forEach(r => {
            stats[r.status] = parseInt(r.count);
            stats.total += parseInt(r.count);
        });
        return stats;
    }
    async recordPreCheck(dto, tenantId, user) {
        const queue = await this.getById(dto.queue_id, tenantId);
        let bmi = null;
        if (dto.weight && dto.height) {
            const heightM = dto.height / 100;
            bmi = parseFloat((dto.weight / (heightM * heightM)).toFixed(1));
        }
        const preCheck = this.preCheckRepo.create({
            tenant_id: tenantId,
            queue_id: dto.queue_id,
            patient_id: queue.patient_id,
            recorded_by: user.id,
            bp_systolic: dto.bp_systolic,
            bp_diastolic: dto.bp_diastolic,
            pulse_rate: dto.pulse_rate,
            temperature: dto.temperature,
            weight: dto.weight,
            height: dto.height,
            bmi,
            spo2: dto.spo2,
            blood_sugar: dto.blood_sugar,
            chief_complaint: dto.chief_complaint,
            allergies: dto.allergies,
            current_medicines: dto.current_medicines,
            notes: dto.notes,
            created_by: user.id,
            updated_by: user.id,
        });
        const saved = await this.preCheckRepo.save(preCheck);
        await this.updateStatus(dto.queue_id, { status: queue_entity_1.QueueStatus.PRECHECK_DONE }, tenantId, user);
        await this.auditService.log({
            tenantId,
            userId: user.id,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'pre_checks',
            entityId: saved.id,
            newValue: { queue_id: dto.queue_id, patient_id: queue.patient_id },
        });
        return saved;
    }
    async getPreCheckByQueue(queueId, tenantId) {
        const preCheck = await this.preCheckRepo
            .createQueryBuilder('pc')
            .leftJoinAndSelect('pc.recorder', 'recorder')
            .where('pc.queue_id = :queueId', { queueId })
            .andWhere('pc.tenant_id = :tenantId', { tenantId })
            .getOne();
        if (!preCheck)
            throw new common_1.NotFoundException('Pre-check not found for this queue entry');
        return preCheck;
    }
};
exports.QueueService = QueueService;
exports.QueueService = QueueService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(queue_entity_1.Queue)),
    __param(1, (0, typeorm_1.InjectRepository)(pre_check_entity_1.PreCheck)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService,
        typeorm_2.DataSource])
], QueueService);
//# sourceMappingURL=queue.service.js.map