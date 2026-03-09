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
exports.PrescriptionController = exports.ConsultationController = void 0;
const common_1 = require("@nestjs/common");
const consultation_service_1 = require("./consultation.service");
const consultation_dto_1 = require("./consultation.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
let ConsultationController = class ConsultationController {
    constructor(consultationService) {
        this.consultationService = consultationService;
    }
    start(dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.consultationService.startConsultation(dto, req.tenantId, user);
    }
    getById(id, req) {
        return this.consultationService.getById(id, req.tenantId);
    }
    getByQueue(queueId, req) {
        return this.consultationService.getByQueue(queueId, req.tenantId);
    }
    getByPatient(patientId, req) {
        return this.consultationService.getByPatient(patientId, req.tenantId);
    }
    complete(id, dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.consultationService.completeConsultation(id, dto, req.tenantId, user);
    }
};
exports.ConsultationController = ConsultationController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [consultation_dto_1.CreateConsultationDto, Object]),
    __metadata("design:returntype", void 0)
], ConsultationController.prototype, "start", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConsultationController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('queue/:queueId'),
    __param(0, (0, common_1.Param)('queueId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConsultationController.prototype, "getByQueue", null);
__decorate([
    (0, common_1.Get)('patient/:patientId'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ConsultationController.prototype, "getByPatient", null);
__decorate([
    (0, common_1.Patch)(':id/complete'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, consultation_dto_1.UpdateConsultationDto, Object]),
    __metadata("design:returntype", void 0)
], ConsultationController.prototype, "complete", null);
exports.ConsultationController = ConsultationController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    (0, common_1.Controller)('consultations'),
    __metadata("design:paramtypes", [consultation_service_1.ConsultationService])
], ConsultationController);
let PrescriptionController = class PrescriptionController {
    constructor(consultationService) {
        this.consultationService = consultationService;
    }
    create(dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.consultationService.createPrescription(dto, req.tenantId, user);
    }
    getById(id, req) {
        return this.consultationService.getPrescriptionById(id, req.tenantId);
    }
    getByPatient(patientId, req) {
        return this.consultationService.getPrescriptionsByPatient(patientId, req.tenantId);
    }
    getByConsultation(consultationId, req) {
        return this.consultationService.getPrescriptionByConsultation(consultationId, req.tenantId);
    }
    markDispensed(id, body, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.consultationService.markDispensed(id, body.sale_id, req.tenantId, user);
    }
};
exports.PrescriptionController = PrescriptionController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [consultation_dto_1.CreatePrescriptionDto, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionController.prototype, "getById", null);
__decorate([
    (0, common_1.Get)('patient/:patientId'),
    __param(0, (0, common_1.Param)('patientId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionController.prototype, "getByPatient", null);
__decorate([
    (0, common_1.Get)('consultation/:consultationId'),
    __param(0, (0, common_1.Param)('consultationId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionController.prototype, "getByConsultation", null);
__decorate([
    (0, common_1.Patch)(':id/dispense'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], PrescriptionController.prototype, "markDispensed", null);
exports.PrescriptionController = PrescriptionController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    (0, common_1.Controller)('prescriptions'),
    __metadata("design:paramtypes", [consultation_service_1.ConsultationService])
], PrescriptionController);
//# sourceMappingURL=consultation.controller.js.map