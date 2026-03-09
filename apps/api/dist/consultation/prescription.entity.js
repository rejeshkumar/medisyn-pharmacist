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
exports.Prescription = exports.PrescriptionStatus = void 0;
const typeorm_1 = require("typeorm");
const tenant_entity_1 = require("../database/entities/tenant.entity");
const user_entity_1 = require("../database/entities/user.entity");
const patient_entity_1 = require("../database/entities/patient.entity");
const consultation_entity_1 = require("./consultation.entity");
const prescription_item_entity_1 = require("./prescription-item.entity");
var PrescriptionStatus;
(function (PrescriptionStatus) {
    PrescriptionStatus["DRAFT"] = "draft";
    PrescriptionStatus["ISSUED"] = "issued";
    PrescriptionStatus["PARTIALLY_DISPENSED"] = "partially_dispensed";
    PrescriptionStatus["FULLY_DISPENSED"] = "fully_dispensed";
    PrescriptionStatus["CANCELLED"] = "cancelled";
})(PrescriptionStatus || (exports.PrescriptionStatus = PrescriptionStatus = {}));
let Prescription = class Prescription {
};
exports.Prescription = Prescription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Prescription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Prescription.prototype, "tenant_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant),
    (0, typeorm_1.JoinColumn)({ name: 'tenant_id' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], Prescription.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Prescription.prototype, "consultation_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => consultation_entity_1.Consultation),
    (0, typeorm_1.JoinColumn)({ name: 'consultation_id' }),
    __metadata("design:type", consultation_entity_1.Consultation)
], Prescription.prototype, "consultation", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Prescription.prototype, "patient_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_entity_1.Patient),
    (0, typeorm_1.JoinColumn)({ name: 'patient_id' }),
    __metadata("design:type", patient_entity_1.Patient)
], Prescription.prototype, "patient", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Prescription.prototype, "doctor_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'doctor_id' }),
    __metadata("design:type", user_entity_1.User)
], Prescription.prototype, "doctor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], Prescription.prototype, "prescription_no", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.ISSUED }),
    __metadata("design:type", String)
], Prescription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Prescription.prototype, "sale_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Prescription.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'NOW()' }),
    __metadata("design:type", Date)
], Prescription.prototype, "issued_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Prescription.prototype, "dispensed_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => prescription_item_entity_1.PrescriptionItem, item => item.prescription, { cascade: true, eager: true }),
    __metadata("design:type", Array)
], Prescription.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Prescription.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Prescription.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Prescription.prototype, "updated_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Prescription.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Prescription.prototype, "updated_at", void 0);
exports.Prescription = Prescription = __decorate([
    (0, typeorm_1.Entity)('prescriptions')
], Prescription);
//# sourceMappingURL=prescription.entity.js.map