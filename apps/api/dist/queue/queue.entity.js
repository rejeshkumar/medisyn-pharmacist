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
exports.Queue = exports.ConsultationType = exports.QueueStatus = void 0;
const typeorm_1 = require("typeorm");
const tenant_entity_1 = require("../database/entities/tenant.entity");
const user_entity_1 = require("../database/entities/user.entity");
const patient_entity_1 = require("../database/entities/patient.entity");
var QueueStatus;
(function (QueueStatus) {
    QueueStatus["WAITING"] = "waiting";
    QueueStatus["IN_PRECHECK"] = "in_precheck";
    QueueStatus["PRECHECK_DONE"] = "precheck_done";
    QueueStatus["IN_CONSULTATION"] = "in_consultation";
    QueueStatus["CONSULTATION_DONE"] = "consultation_done";
    QueueStatus["DISPENSING"] = "dispensing";
    QueueStatus["COMPLETED"] = "completed";
    QueueStatus["CANCELLED"] = "cancelled";
    QueueStatus["NO_SHOW"] = "no_show";
})(QueueStatus || (exports.QueueStatus = QueueStatus = {}));
var ConsultationType;
(function (ConsultationType) {
    ConsultationType["NEW"] = "new";
    ConsultationType["FOLLOW_UP"] = "follow_up";
    ConsultationType["EMERGENCY"] = "emergency";
})(ConsultationType || (exports.ConsultationType = ConsultationType = {}));
let Queue = class Queue {
};
exports.Queue = Queue;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Queue.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Queue.prototype, "tenant_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tenant_entity_1.Tenant),
    (0, typeorm_1.JoinColumn)({ name: 'tenant_id' }),
    __metadata("design:type", tenant_entity_1.Tenant)
], Queue.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid' }),
    __metadata("design:type", String)
], Queue.prototype, "patient_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => patient_entity_1.Patient),
    (0, typeorm_1.JoinColumn)({ name: 'patient_id' }),
    __metadata("design:type", patient_entity_1.Patient)
], Queue.prototype, "patient", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Queue.prototype, "doctor_id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'doctor_id' }),
    __metadata("design:type", user_entity_1.User)
], Queue.prototype, "doctor", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], Queue.prototype, "token_number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'date', default: () => 'CURRENT_DATE' }),
    __metadata("design:type", String)
], Queue.prototype, "visit_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: QueueStatus, default: QueueStatus.WAITING }),
    __metadata("design:type", String)
], Queue.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ConsultationType, default: ConsultationType.NEW }),
    __metadata("design:type", String)
], Queue.prototype, "visit_type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Queue.prototype, "chief_complaint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Queue.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', default: () => 'NOW()' }),
    __metadata("design:type", Date)
], Queue.prototype, "registered_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Queue.prototype, "called_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], Queue.prototype, "completed_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    __metadata("design:type", Boolean)
], Queue.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Queue.prototype, "created_by", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Queue.prototype, "updated_by", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Queue.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], Queue.prototype, "updated_at", void 0);
exports.Queue = Queue = __decorate([
    (0, typeorm_1.Entity)('queues')
], Queue);
//# sourceMappingURL=queue.entity.js.map