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
exports.MedicinesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
let MedicinesService = class MedicinesService {
    constructor(medicinesRepo, batchRepo, auditService) {
        this.medicinesRepo = medicinesRepo;
        this.batchRepo = batchRepo;
        this.auditService = auditService;
    }
    async findAll(tenantId, search, category, scheduleClass) {
        const qb = this.medicinesRepo
            .createQueryBuilder('m')
            .where('m.tenant_id = :tenantId', { tenantId });
        if (search) {
            qb.andWhere('(m.brand_name ILIKE :s OR m.molecule ILIKE :s)', { s: `%${search}%` });
        }
        if (category)
            qb.andWhere('m.category = :category', { category });
        if (scheduleClass)
            qb.andWhere('m.schedule_class = :sc', { sc: scheduleClass });
        qb.orderBy('m.brand_name', 'ASC');
        return qb.getMany();
    }
    async findOne(id, tenantId) {
        const med = await this.medicinesRepo.findOne({ where: { id, tenant_id: tenantId } });
        if (!med)
            throw new common_1.NotFoundException('Medicine not found');
        return med;
    }
    async create(dto, user) {
        const { id: userId, tenant_id: tenantId } = user;
        if (!dto.substitute_group_key) {
            dto.substitute_group_key = `${dto.molecule?.toLowerCase().replace(/\s+/g, '_')}_${dto.strength?.toLowerCase().replace(/\s+/g, '')}_${dto.dosage_form?.toLowerCase()}`;
        }
        const medicine = this.medicinesRepo.create({
            ...dto,
            tenant_id: tenantId,
            created_by: userId,
        });
        const saved = await this.medicinesRepo.save(medicine);
        await this.auditService.log({
            tenantId, userId,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'Medicine',
            entityId: saved.id,
            entityRef: `${saved.brand_name} ${saved.strength}`,
            newValue: { brand_name: saved.brand_name, molecule: saved.molecule, schedule_class: saved.schedule_class },
        });
        return saved;
    }
    async update(id, dto, user) {
        const { id: userId, tenant_id: tenantId } = user;
        const medicine = await this.findOne(id, tenantId);
        const oldValue = { brand_name: medicine.brand_name, schedule_class: medicine.schedule_class, is_active: medicine.is_active };
        Object.assign(medicine, dto);
        medicine.updated_by = userId;
        const saved = await this.medicinesRepo.save(medicine);
        await this.auditService.log({
            tenantId, userId,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.UPDATE,
            entity: 'Medicine',
            entityId: id,
            entityRef: `${medicine.brand_name} ${medicine.strength}`,
            oldValue,
            newValue: dto,
        });
        return saved;
    }
    async deactivate(id, user) {
        const { id: userId, tenant_id: tenantId } = user;
        const medicine = await this.findOne(id, tenantId);
        medicine.is_active = false;
        medicine.updated_by = userId;
        const saved = await this.medicinesRepo.save(medicine);
        await this.auditService.log({
            tenantId, userId,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.DEACTIVATE,
            entity: 'Medicine',
            entityId: id,
            entityRef: `${medicine.brand_name} ${medicine.strength}`,
            oldValue: { is_active: true },
            newValue: { is_active: false },
        });
        return saved;
    }
    async getSubstitutes(id, tenantId) {
        const medicine = await this.findOne(id, tenantId);
        if (!medicine.substitute_group_key)
            return [];
        const substitutes = await this.medicinesRepo.find({
            where: {
                substitute_group_key: medicine.substitute_group_key,
                is_active: true,
                tenant_id: tenantId,
            },
        });
        const result = [];
        for (const sub of substitutes) {
            if (sub.id === id)
                continue;
            const batches = await this.batchRepo
                .createQueryBuilder('b')
                .where('b.medicine_id = :mid', { mid: sub.id })
                .andWhere('b.tenant_id = :tenantId', { tenantId })
                .andWhere('b.quantity > 0')
                .andWhere('b.expiry_date > NOW()')
                .orderBy('b.expiry_date', 'ASC')
                .getMany();
            const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
            result.push({ ...sub, available_stock: totalStock, batches: batches.slice(0, 3) });
        }
        return result.sort((a, b) => b.available_stock - a.available_stock);
    }
    async getWithStock(tenantId) {
        return this.medicinesRepo
            .createQueryBuilder('m')
            .leftJoinAndSelect('m.batches', 'b', 'b.quantity > 0 AND b.expiry_date > NOW()')
            .where('m.is_active = true')
            .andWhere('m.tenant_id = :tenantId', { tenantId })
            .getMany();
    }
};
exports.MedicinesService = MedicinesService;
exports.MedicinesService = MedicinesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(medicine_entity_1.Medicine)),
    __param(1, (0, typeorm_1.InjectRepository)(stock_batch_entity_1.StockBatch)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], MedicinesService);
//# sourceMappingURL=medicines.service.js.map