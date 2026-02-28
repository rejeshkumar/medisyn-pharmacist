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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const sale_entity_1 = require("../database/entities/sale.entity");
const sale_item_entity_1 = require("../database/entities/sale-item.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const schedule_drug_log_entity_1 = require("../database/entities/schedule-drug-log.entity");
const medicine_entity_2 = require("../database/entities/medicine.entity");
const dayjs = require("dayjs");
let SalesService = class SalesService {
    constructor(saleRepo, saleItemRepo, batchRepo, medicineRepo, scheduleLogRepo, dataSource) {
        this.saleRepo = saleRepo;
        this.saleItemRepo = saleItemRepo;
        this.batchRepo = batchRepo;
        this.medicineRepo = medicineRepo;
        this.scheduleLogRepo = scheduleLogRepo;
        this.dataSource = dataSource;
    }
    async createSale(dto, userId) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let subtotal = 0;
            let taxAmount = 0;
            const saleItemsData = [];
            let hasScheduledDrugs = false;
            for (const item of dto.items) {
                const batch = await queryRunner.manager.findOne(stock_batch_entity_1.StockBatch, {
                    where: { id: item.batch_id },
                    lock: { mode: 'pessimistic_write' },
                });
                if (batch) {
                    batch.medicine = await queryRunner.manager.findOne(medicine_entity_1.Medicine, {
                        where: { id: batch.medicine_id },
                    });
                }
                if (!batch)
                    throw new common_1.NotFoundException(`Batch ${item.batch_id} not found`);
                if (batch.quantity < item.qty) {
                    throw new common_1.BadRequestException(`Insufficient stock for batch ${batch.batch_number}. Available: ${batch.quantity}`);
                }
                const medicine = batch.medicine;
                const rate = item.rate || batch.sale_rate;
                const itemSubtotal = rate * item.qty;
                const gstPercent = item.gst_percent ?? medicine.gst_percent ?? 0;
                const itemTax = (itemSubtotal * gstPercent) / 100;
                subtotal += itemSubtotal;
                taxAmount += itemTax;
                if (medicine.schedule_class === medicine_entity_2.ScheduleClass.H1 ||
                    medicine.schedule_class === medicine_entity_2.ScheduleClass.X) {
                    hasScheduledDrugs = true;
                }
                batch.quantity -= item.qty;
                await queryRunner.manager.save(stock_batch_entity_1.StockBatch, batch);
                saleItemsData.push({
                    medicine_id: item.medicine_id,
                    batch_id: item.batch_id,
                    qty: item.qty,
                    rate,
                    gst_percent: gstPercent,
                    item_total: itemSubtotal + itemTax,
                    is_substituted: item.is_substituted || false,
                    original_medicine_id: item.original_medicine_id,
                    substitution_reason: item.substitution_reason,
                    medicine_name: medicine.brand_name,
                    batch_number: batch.batch_number,
                });
            }
            const discountAmount = dto.discount_amount || (subtotal * (dto.discount_percent || 0)) / 100;
            const totalAmount = subtotal + taxAmount - discountAmount;
            const billNumber = await this.generateBillNumber();
            const sale = queryRunner.manager.create(sale_entity_1.Sale, {
                bill_number: billNumber,
                customer_name: dto.customer_name,
                doctor_name: dto.doctor_name,
                doctor_reg_no: dto.doctor_reg_no,
                subtotal,
                discount_amount: discountAmount,
                discount_percent: dto.discount_percent || 0,
                tax_amount: taxAmount,
                total_amount: totalAmount,
                payment_mode: dto.payment_mode,
                prescription_image_url: dto.prescription_image_url,
                ai_prescription_id: dto.ai_prescription_id,
                notes: dto.notes,
                has_scheduled_drugs: hasScheduledDrugs,
                created_by: userId,
            });
            const savedSale = await queryRunner.manager.save(sale_entity_1.Sale, sale);
            for (const itemData of saleItemsData) {
                const saleItem = queryRunner.manager.create(sale_item_entity_1.SaleItem, {
                    ...itemData,
                    sale_id: savedSale.id,
                });
                const savedItem = await queryRunner.manager.save(sale_item_entity_1.SaleItem, saleItem);
                if (dto.compliance_data &&
                    (itemData.is_substituted ||
                        (await this.isScheduledDrug(itemData.medicine_id)))) {
                    const medicine = await queryRunner.manager.findOne(medicine_entity_1.Medicine, {
                        where: { id: itemData.medicine_id },
                    });
                    if (medicine &&
                        (medicine.schedule_class === medicine_entity_2.ScheduleClass.H ||
                            medicine.schedule_class === medicine_entity_2.ScheduleClass.H1 ||
                            medicine.schedule_class === medicine_entity_2.ScheduleClass.X)) {
                        const log = queryRunner.manager.create(schedule_drug_log_entity_1.ScheduleDrugLog, {
                            sale_id: savedSale.id,
                            sale_item_id: savedItem.id,
                            patient_name: dto.compliance_data.patient_name,
                            doctor_name: dto.compliance_data.doctor_name,
                            doctor_reg_no: dto.compliance_data.doctor_reg_no,
                            prescription_image_url: dto.prescription_image_url,
                            medicine_name: medicine.brand_name,
                            schedule_class: medicine.schedule_class,
                            quantity_dispensed: itemData.qty,
                            batch_number: itemData.batch_number,
                            pharmacist_id: userId,
                            is_substituted: itemData.is_substituted,
                            substitution_reason: itemData.substitution_reason,
                        });
                        await queryRunner.manager.save(schedule_drug_log_entity_1.ScheduleDrugLog, log);
                    }
                }
            }
            await queryRunner.commitTransaction();
            return this.findOne(savedSale.id);
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async isScheduledDrug(medicineId) {
        const medicine = await this.medicineRepo.findOne({
            where: { id: medicineId },
        });
        return medicine && medicine.schedule_class !== medicine_entity_2.ScheduleClass.OTC;
    }
    async findAll(from, to, search) {
        const qb = this.saleRepo
            .createQueryBuilder('s')
            .leftJoinAndSelect('s.pharmacist', 'u')
            .orderBy('s.created_at', 'DESC');
        if (from && to) {
            qb.where('s.created_at BETWEEN :from AND :to', {
                from: new Date(from),
                to: new Date(to + 'T23:59:59'),
            });
        }
        if (search) {
            qb.andWhere('(s.bill_number ILIKE :s OR s.customer_name ILIKE :s)', { s: `%${search}%` });
        }
        return qb.getMany();
    }
    async findOne(id) {
        const sale = await this.saleRepo.findOne({
            where: { id },
            relations: ['items', 'items.medicine', 'items.batch', 'pharmacist'],
        });
        if (!sale)
            throw new common_1.NotFoundException('Sale not found');
        return sale;
    }
    async findByBillNumber(billNumber) {
        const sale = await this.saleRepo.findOne({
            where: { bill_number: billNumber },
            relations: ['items', 'items.medicine', 'items.batch', 'pharmacist'],
        });
        if (!sale)
            throw new common_1.NotFoundException('Bill not found');
        return sale;
    }
    async voidSale(id, reason, userId) {
        const sale = await this.findOne(id);
        if (sale.is_voided)
            throw new common_1.BadRequestException('Bill is already voided');
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            for (const item of sale.items) {
                const batch = await queryRunner.manager.findOne(stock_batch_entity_1.StockBatch, {
                    where: { id: item.batch_id },
                    lock: { mode: 'pessimistic_write' },
                });
                if (batch) {
                    batch.quantity += item.qty;
                    await queryRunner.manager.save(stock_batch_entity_1.StockBatch, batch);
                }
            }
            sale.is_voided = true;
            sale.voided_by = userId;
            sale.voided_reason = reason;
            await queryRunner.manager.save(sale_entity_1.Sale, sale);
            await queryRunner.commitTransaction();
            return { message: 'Bill voided successfully' };
        }
        catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        }
        finally {
            await queryRunner.release();
        }
    }
    async generateBillNumber() {
        const today = dayjs().format('YYYYMMDD');
        const count = await this.saleRepo.count();
        return `BILL-${today}-${String(count + 1).padStart(4, '0')}`;
    }
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(sale_entity_1.Sale)),
    __param(1, (0, typeorm_1.InjectRepository)(sale_item_entity_1.SaleItem)),
    __param(2, (0, typeorm_1.InjectRepository)(stock_batch_entity_1.StockBatch)),
    __param(3, (0, typeorm_1.InjectRepository)(medicine_entity_1.Medicine)),
    __param(4, (0, typeorm_1.InjectRepository)(schedule_drug_log_entity_1.ScheduleDrugLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], SalesService);
//# sourceMappingURL=sales.service.js.map