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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScheduleDrugLog = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
const sale_entity_1 = require("./sale.entity");
const sale_item_entity_1 = require("./sale-item.entity");
let ScheduleDrugLog = class ScheduleDrugLog {
};
exports.ScheduleDrugLog = ScheduleDrugLog;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "sale_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => sale_entity_1.Sale),
    (0, typeorm_1.JoinColumn)({ name: 'sale_id' }),
    __metadata("design:type", sale_entity_1.Sale)
], ScheduleDrugLog.prototype, "sale", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "sale_item_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => sale_item_entity_1.SaleItem),
    (0, typeorm_1.JoinColumn)({ name: 'sale_item_id' }),
    __metadata("design:type", sale_item_entity_1.SaleItem)
], ScheduleDrugLog.prototype, "sale_item", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "patient_name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "doctor_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "doctor_reg_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "prescription_image_url", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "medicine_name", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "schedule_class", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], ScheduleDrugLog.prototype, "quantity_dispensed", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "batch_number", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "pharmacist_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'pharmacist_id' }),
    __metadata("design:type", user_entity_1.User)
], ScheduleDrugLog.prototype, "pharmacist", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: false }),
    __metadata("design:type", Boolean)
], ScheduleDrugLog.prototype, "is_substituted", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], ScheduleDrugLog.prototype, "substitution_reason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], ScheduleDrugLog.prototype, "created_at", void 0);
exports.ScheduleDrugLog = ScheduleDrugLog = __decorate([
    (0, typeorm_1.Entity)('schedule_drug_logs')
], ScheduleDrugLog);
//# sourceMappingURL=schedule-drug-log.entity.js.map