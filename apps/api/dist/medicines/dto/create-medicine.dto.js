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
exports.CreateMedicineDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const medicine_entity_1 = require("../../database/entities/medicine.entity");
class CreateMedicineDto {
}
exports.CreateMedicineDto = CreateMedicineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "brand_name", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "molecule", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "strength", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: medicine_entity_1.DosageForm, default: medicine_entity_1.DosageForm.TABLET }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "dosage_form", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: medicine_entity_1.ScheduleClass }),
    (0, class_validator_1.IsEnum)(medicine_entity_1.ScheduleClass),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "schedule_class", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "substitute_group_key", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateMedicineDto.prototype, "gst_percent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateMedicineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateMedicineDto.prototype, "sale_rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "manufacturer", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "category", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: medicine_entity_1.RxUnit, description: 'Dispensing unit (mg, ml, units, etc.)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "rx_units", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Stock group / therapeutic group' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "stock_group", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'What condition this medicine treats' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "treatment_for", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Additional notes or description' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Default medicine-level discount percentage' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateMedicineDto.prototype, "discount_percent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Shelf / rack location in pharmacy (e.g. A-12)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "rack_location", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: medicine_entity_1.IntakeRoute, description: 'Route of administration' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateMedicineDto.prototype, "intake_route", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Minimum stock qty before reorder alert' }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreateMedicineDto.prototype, "reorder_qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Whether a prescription (Rx) is mandatory' }),
    (0, class_validator_1.IsBoolean)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Boolean)
], CreateMedicineDto.prototype, "is_rx_required", void 0);
//# sourceMappingURL=create-medicine.dto.js.map