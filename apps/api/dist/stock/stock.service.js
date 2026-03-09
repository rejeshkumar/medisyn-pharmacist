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
exports.StockService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const stock_adjustment_entity_1 = require("../database/entities/stock-adjustment.entity");
const supplier_entity_1 = require("../database/entities/supplier.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
const dayjs = require("dayjs");
let StockService = class StockService {
    constructor(batchRepo, adjustmentRepo, supplierRepo, medicineRepo, auditService) {
        this.batchRepo = batchRepo;
        this.adjustmentRepo = adjustmentRepo;
        this.supplierRepo = supplierRepo;
        this.medicineRepo = medicineRepo;
        this.auditService = auditService;
    }
    async getStockList(tenantId, filters) {
        const qb = this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .leftJoinAndSelect('b.supplier', 's')
            .where('b.is_active = true')
            .andWhere('b.tenant_id = :tenantId', { tenantId });
        if (filters.search) {
            qb.andWhere('(m.brand_name ILIKE :search OR m.molecule ILIKE :search)', { search: `%${filters.search}%` });
        }
        if (filters.expiryDays) {
            const expiryDate = dayjs().add(filters.expiryDays, 'day').toDate();
            qb.andWhere('b.expiry_date <= :expiryDate', { expiryDate });
            qb.andWhere('b.expiry_date > NOW()');
        }
        if (filters.lowStock)
            qb.andWhere('b.quantity <= 10');
        if (filters.scheduleClass)
            qb.andWhere('m.schedule_class = :sc', { sc: filters.scheduleClass });
        if (filters.supplierId)
            qb.andWhere('b.supplier_id = :sid', { sid: filters.supplierId });
        if (filters.molecule)
            qb.andWhere('m.molecule ILIKE :molecule', { molecule: `%${filters.molecule}%` });
        if (filters.category)
            qb.andWhere('m.category = :category', { category: filters.category });
        qb.orderBy('m.brand_name', 'ASC').addOrderBy('b.expiry_date', 'ASC');
        return qb.getMany();
    }
    async getBatchesForMedicine(medicineId, tenantId) {
        return this.batchRepo.find({
            where: { medicine_id: medicineId, is_active: true, tenant_id: tenantId },
            order: { expiry_date: 'ASC' },
            relations: ['supplier'],
        });
    }
    async addPurchase(dto, user) {
        const { id: userId, tenant_id: tenantId } = user;
        const batches = [];
        for (const item of dto.items) {
            const medicine = await this.medicineRepo.findOne({
                where: { id: item.medicine_id, tenant_id: tenantId },
            });
            if (!medicine)
                throw new common_1.NotFoundException(`Medicine ${item.medicine_id} not found`);
            const batch = this.batchRepo.create({
                medicine_id: item.medicine_id,
                batch_number: item.batch_number,
                expiry_date: item.expiry_date,
                quantity: item.quantity,
                purchase_price: item.purchase_price,
                mrp: item.mrp,
                sale_rate: item.sale_rate || item.mrp,
                supplier_id: dto.supplier_id,
                purchase_invoice_no: dto.invoice_no,
                notes: item.notes,
                tenant_id: tenantId,
                created_by: userId,
            });
            const saved = await this.batchRepo.save(batch);
            batches.push(saved);
            await this.auditService.log({
                tenantId, userId,
                userName: user.full_name,
                userRole: user.role,
                action: audit_log_entity_1.AuditAction.STOCK_IN,
                entity: 'StockBatch',
                entityId: saved.id,
                entityRef: `${medicine.brand_name} — Batch ${item.batch_number}`,
                newValue: {
                    medicine: medicine.brand_name,
                    batch: item.batch_number,
                    quantity: item.quantity,
                    expiry: item.expiry_date,
                    invoice: dto.invoice_no,
                },
            });
        }
        return batches;
    }
    async adjustStock(dto, user) {
        const { id: userId, tenant_id: tenantId } = user;
        const batch = await this.batchRepo.findOne({
            where: { id: dto.batch_id, tenant_id: tenantId },
            relations: ['medicine'],
        });
        if (!batch)
            throw new common_1.NotFoundException('Batch not found');
        const quantityBefore = batch.quantity;
        const quantityChange = -Math.abs(dto.quantity);
        const quantityAfter = batch.quantity + quantityChange;
        if (quantityAfter < 0) {
            throw new common_1.BadRequestException('Adjustment quantity exceeds available stock');
        }
        batch.quantity = quantityAfter;
        batch.updated_by = userId;
        await this.batchRepo.save(batch);
        const adjustment = this.adjustmentRepo.create({
            batch_id: dto.batch_id,
            quantity_change: quantityChange,
            quantity_before: quantityBefore,
            quantity_after: quantityAfter,
            adjustment_type: dto.adjustment_type,
            notes: dto.notes,
            performed_by: userId,
            tenant_id: tenantId,
            created_by: userId,
        });
        const saved = await this.adjustmentRepo.save(adjustment);
        await this.auditService.log({
            tenantId, userId,
            userName: user.full_name,
            userRole: user.role,
            action: audit_log_entity_1.AuditAction.STOCK_ADJUST,
            entity: 'StockBatch',
            entityId: dto.batch_id,
            entityRef: `${batch.medicine?.brand_name || 'Unknown'} — Batch ${batch.batch_number}`,
            oldValue: { quantity: quantityBefore },
            newValue: { quantity: quantityAfter, change: quantityChange, reason: dto.adjustment_type, notes: dto.notes },
        });
        return saved;
    }
    async getLowStockAlerts(tenantId, threshold = 10) {
        return this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .where('b.quantity <= :threshold', { threshold })
            .andWhere('b.quantity > 0')
            .andWhere('b.is_active = true')
            .andWhere('b.expiry_date > NOW()')
            .andWhere('b.tenant_id = :tenantId', { tenantId })
            .orderBy('b.quantity', 'ASC')
            .getMany();
    }
    async getNearExpiryAlerts(tenantId, days = 90) {
        const targetDate = dayjs().add(days, 'day').toDate();
        return this.batchRepo
            .createQueryBuilder('b')
            .leftJoinAndSelect('b.medicine', 'm')
            .where('b.expiry_date <= :targetDate', { targetDate })
            .andWhere('b.expiry_date > NOW()')
            .andWhere('b.quantity > 0')
            .andWhere('b.is_active = true')
            .andWhere('b.tenant_id = :tenantId', { tenantId })
            .orderBy('b.expiry_date', 'ASC')
            .getMany();
    }
    async getSuppliers(tenantId) {
        return this.supplierRepo.find({
            where: { is_active: true, tenant_id: tenantId },
            order: { name: 'ASC' },
        });
    }
    async createSupplier(data, user) {
        const { id: userId, tenant_id: tenantId } = user;
        const supplier = this.supplierRepo.create({
            ...data,
            tenant_id: tenantId,
            created_by: userId,
        });
        return this.supplierRepo.save(supplier);
    }
    async getBestBatch(medicineId, tenantId) {
        return this.batchRepo
            .createQueryBuilder('b')
            .where('b.medicine_id = :mid', { mid: medicineId })
            .andWhere('b.tenant_id = :tenantId', { tenantId })
            .andWhere('b.quantity > 0')
            .andWhere('b.expiry_date > NOW()')
            .andWhere("b.expiry_date > NOW() + INTERVAL '30 days'")
            .orderBy('b.expiry_date', 'ASC')
            .getOne();
    }
};
exports.StockService = StockService;
exports.StockService = StockService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(stock_batch_entity_1.StockBatch)),
    __param(1, (0, typeorm_1.InjectRepository)(stock_adjustment_entity_1.StockAdjustment)),
    __param(2, (0, typeorm_1.InjectRepository)(supplier_entity_1.Supplier)),
    __param(3, (0, typeorm_1.InjectRepository)(medicine_entity_1.Medicine)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], StockService);
//# sourceMappingURL=stock.service.js.map