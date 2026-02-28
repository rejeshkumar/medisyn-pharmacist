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
exports.AiPrescription = exports.ExtractionStatus = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("./user.entity");
var ExtractionStatus;
(function (ExtractionStatus) {
    ExtractionStatus["PENDING"] = "pending";
    ExtractionStatus["PROCESSING"] = "processing";
    ExtractionStatus["COMPLETED"] = "completed";
    ExtractionStatus["FAILED"] = "failed";
})(ExtractionStatus || (exports.ExtractionStatus = ExtractionStatus = {}));
let AiPrescription = class AiPrescription {
};
exports.AiPrescription = AiPrescription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], AiPrescription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiPrescription.prototype, "sale_id", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiPrescription.prototype, "uploaded_by", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'uploaded_by' }),
    __metadata("design:type", user_entity_1.User)
], AiPrescription.prototype, "uploader", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], AiPrescription.prototype, "image_url", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb', nullable: true }),
    __metadata("design:type", Object)
], AiPrescription.prototype, "extraction_json", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiPrescription.prototype, "patient_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiPrescription.prototype, "doctor_name", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiPrescription.prototype, "confidence_summary", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: ExtractionStatus,
        default: ExtractionStatus.PENDING,
    }),
    __metadata("design:type", String)
], AiPrescription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], AiPrescription.prototype, "error_message", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], AiPrescription.prototype, "created_at", void 0);
exports.AiPrescription = AiPrescription = __decorate([
    (0, typeorm_1.Entity)('ai_prescriptions')
], AiPrescription);
//# sourceMappingURL=ai-prescription.entity.js.map