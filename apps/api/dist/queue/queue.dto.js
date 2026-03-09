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
exports.RecordPreCheckDto = exports.UpdateQueueStatusDto = exports.CreateQueueDto = void 0;
const class_validator_1 = require("class-validator");
const queue_entity_1 = require("./queue.entity");
class CreateQueueDto {
}
exports.CreateQueueDto = CreateQueueDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "patient_id", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "doctor_id", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(queue_entity_1.ConsultationType),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "visit_type", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "chief_complaint", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateQueueDto.prototype, "notes", void 0);
class UpdateQueueStatusDto {
}
exports.UpdateQueueStatusDto = UpdateQueueStatusDto;
__decorate([
    (0, class_validator_1.IsEnum)(['waiting', 'in_precheck', 'precheck_done', 'in_consultation',
        'consultation_done', 'dispensing', 'completed', 'cancelled', 'no_show']),
    __metadata("design:type", String)
], UpdateQueueStatusDto.prototype, "status", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], UpdateQueueStatusDto.prototype, "doctor_id", void 0);
class RecordPreCheckDto {
}
exports.RecordPreCheckDto = RecordPreCheckDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], RecordPreCheckDto.prototype, "queue_id", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "bp_systolic", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "bp_diastolic", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "pulse_rate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "temperature", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "weight", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "height", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "spo2", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], RecordPreCheckDto.prototype, "blood_sugar", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPreCheckDto.prototype, "chief_complaint", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPreCheckDto.prototype, "allergies", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPreCheckDto.prototype, "current_medicines", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RecordPreCheckDto.prototype, "notes", void 0);
//# sourceMappingURL=queue.dto.js.map