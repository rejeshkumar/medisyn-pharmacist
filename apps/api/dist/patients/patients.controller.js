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
exports.PatientsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const patients_service_1 = require("./patients.service");
const create_patient_dto_1 = require("./dto/create-patient.dto");
const create_appointment_dto_1 = require("./dto/create-appointment.dto");
const create_reminder_dto_1 = require("./dto/create-reminder.dto");
const public_decorator_1 = require("../common/decorators/public.decorator");
let PatientsController = class PatientsController {
    constructor(patientsService) {
        this.patientsService = patientsService;
    }
    vipRegister(dto) {
        return this.patientsService.vipRegister(dto, '00000000-0000-0000-0000-000000000001');
    }
    getStats(req) {
        return this.patientsService.getStats(req.tenantId);
    }
    getTodaySchedule(req) {
        return this.patientsService.getTodaySchedule(req.tenantId);
    }
    getMissedAppointments(req) {
        return this.patientsService.getMissedAppointments(req.tenantId);
    }
    getUpcomingAppointments(req) {
        return this.patientsService.getUpcomingAppointments(req.tenantId);
    }
    getDueReminders(req) {
        return this.patientsService.getDueReminders(req.tenantId);
    }
    findAll(req, search, isVip, category) {
        const vipFilter = isVip === 'true' ? true : isVip === 'false' ? false : undefined;
        return this.patientsService.findAll(req.tenantId, search, vipFilter, category);
    }
    create(dto, req) {
        return this.patientsService.create(dto, req.user);
    }
    findOne(id, req) {
        return this.patientsService.findOne(id, req.tenantId);
    }
    update(id, dto, req) {
        return this.patientsService.update(id, dto, req.user);
    }
    getAppointments(id, req) {
        return this.patientsService.getAppointments(id, req.tenantId);
    }
    createAppointment(id, dto, req) {
        return this.patientsService.createAppointment(id, dto, req.user);
    }
    updateAppointment(apptId, dto, req) {
        return this.patientsService.updateAppointment(apptId, dto, req.tenantId);
    }
    getReminders(id, req) {
        return this.patientsService.getReminders(id, req.tenantId);
    }
    createReminder(id, dto, req) {
        return this.patientsService.createReminder(id, dto, req.user);
    }
    markReminderDone(reminderId, req) {
        return this.patientsService.markReminderDone(reminderId, req.tenantId);
    }
};
exports.PatientsController = PatientsController;
__decorate([
    (0, public_decorator_1.Public)(),
    (0, common_1.Post)('vip-register'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_dto_1.VipRegisterDto]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "vipRegister", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('appointments/today'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getTodaySchedule", null);
__decorate([
    (0, common_1.Get)('appointments/missed'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getMissedAppointments", null);
__decorate([
    (0, common_1.Get)('appointments/upcoming'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getUpcomingAppointments", null);
__decorate([
    (0, common_1.Get)('reminders/due'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getDueReminders", null);
__decorate([
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'is_vip', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'category', required: false }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('search')),
    __param(2, (0, common_1.Query)('is_vip')),
    __param(3, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_patient_dto_1.CreatePatientDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "update", null);
__decorate([
    (0, common_1.Get)(':id/appointments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getAppointments", null);
__decorate([
    (0, common_1.Post)(':id/appointments'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_appointment_dto_1.CreateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "createAppointment", null);
__decorate([
    (0, common_1.Patch)('appointments/:apptId'),
    __param(0, (0, common_1.Param)('apptId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_appointment_dto_1.UpdateAppointmentDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "updateAppointment", null);
__decorate([
    (0, common_1.Get)(':id/reminders'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "getReminders", null);
__decorate([
    (0, common_1.Post)(':id/reminders'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, create_reminder_dto_1.CreateReminderDto, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "createReminder", null);
__decorate([
    (0, common_1.Patch)('reminders/:reminderId/done'),
    __param(0, (0, common_1.Param)('reminderId')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], PatientsController.prototype, "markReminderDone", null);
exports.PatientsController = PatientsController = __decorate([
    (0, swagger_1.ApiTags)('patients'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('patients'),
    __metadata("design:paramtypes", [patients_service_1.PatientsService])
], PatientsController);
//# sourceMappingURL=patients.controller.js.map