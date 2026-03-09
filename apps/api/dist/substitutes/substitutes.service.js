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
exports.SubstitutesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
let SubstitutesService = class SubstitutesService {
    constructor(medicineRepo, batchRepo) {
        this.medicineRepo = medicineRepo;
        this.batchRepo = batchRepo;
    }
    async getSubstitutes(medicineId) {
        const medicine = await this.medicineRepo.findOne({
            where: { id: medicineId },
        });
        if (!medicine || !medicine.substitute_group_key)
            return [];
        const substitutes = await this.medicineRepo.find({
            where: {
                substitute_group_key: medicine.substitute_group_key,
                is_active: true,
            },
        });
        const result = [];
        for (const sub of substitutes) {
            if (sub.id === medicineId)
                continue;
            const batches = await this.batchRepo
                .createQueryBuilder('b')
                .where('b.medicine_id = :mid', { mid: sub.id })
                .andWhere('b.quantity > 0')
                .andWhere('b.expiry_date > NOW()')
                .orderBy('b.expiry_date', 'ASC')
                .getMany();
            const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
            result.push({
                id: sub.id,
                brand_name: sub.brand_name,
                molecule: sub.molecule,
                strength: sub.strength,
                dosage_form: sub.dosage_form,
                mrp: sub.mrp,
                sale_rate: sub.sale_rate,
                available_stock: totalStock,
                best_batch: batches[0] || null,
            });
        }
        return result.sort((a, b) => {
            if (b.available_stock !== a.available_stock)
                return b.available_stock - a.available_stock;
            return (a.sale_rate || 0) - (b.sale_rate || 0);
        });
    }
};
exports.SubstitutesService = SubstitutesService;
exports.SubstitutesService = SubstitutesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(medicine_entity_1.Medicine)),
    __param(1, (0, typeorm_1.InjectRepository)(stock_batch_entity_1.StockBatch)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], SubstitutesService);
//# sourceMappingURL=substitutes.service.js.map