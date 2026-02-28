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
exports.StockAdjustment = exports.AdjustmentType = void 0;
const typeorm_1 = require("typeorm");
const stock_batch_entity_1 = require("./stock-batch.entity");
const user_entity_1 = require("./user.entity");
var AdjustmentType;
(function (AdjustmentType) {
    AdjustmentType["EXPIRED"] = "expired";
    AdjustmentType["BREAKAGE"] = "breakage";
    AdjustmentType["SAMPLE"] = "sample";
    AdjustmentType["CORRECTION"] = "correction";
    AdjustmentType["THEFT_LOSS"] = "theft_loss";
    AdjustmentType["SUPPLIER_RETURN"] = "supplier_return";
})(AdjustmentType || (exports.AdjustmentType = AdjustmentType = {}));
let StockAdjustment = class StockAdjustment {
};
exports.StockAdjustment = StockAdjustment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], StockAdjustment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StockAdjustment.prototype, "batch_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => stock_batch_entity_1.StockBatch),
    (0, typeorm_1.JoinColumn)({ name: 'batch_id' }),
    __metadata("design:type", stock_batch_entity_1.StockBatch)
], StockAdjustment.prototype, "batch", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], StockAdjustment.prototype, "quantity_change", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], StockAdjustment.prototype, "quantity_before", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], StockAdjustment.prototype, "quantity_after", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: AdjustmentType }),
    __metadata("design:type", String)
], StockAdjustment.prototype, "adjustment_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], StockAdjustment.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], StockAdjustment.prototype, "performed_by", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'performed_by' }),
    __metadata("design:type", user_entity_1.User)
], StockAdjustment.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], StockAdjustment.prototype, "created_at", void 0);
exports.StockAdjustment = StockAdjustment = __decorate([
    (0, typeorm_1.Entity)('stock_adjustments')
], StockAdjustment);
//# sourceMappingURL=stock-adjustment.entity.js.map