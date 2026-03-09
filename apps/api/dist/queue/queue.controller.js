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
exports.QueueController = void 0;
const common_1 = require("@nestjs/common");
const queue_service_1 = require("./queue.service");
const queue_dto_1 = require("./queue.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const tenant_guard_1 = require("../common/guards/tenant.guard");
let QueueController = class QueueController {
    constructor(queueService) {
        this.queueService = queueService;
    }
    register(dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.queueService.register(dto, req.tenantId, user);
    }
    getTodayQueue(req, doctorId) {
        return this.queueService.getTodayQueue(req.tenantId, doctorId);
    }
    getTodayStats(req) {
        return this.queueService.getTodayStats(req.tenantId);
    }
    getPreCheck(id, req) {
        return this.queueService.getPreCheckByQueue(id, req.tenantId);
    }
    getById(id, req) {
        return this.queueService.getById(id, req.tenantId);
    }
    updateStatus(id, dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.queueService.updateStatus(id, dto, req.tenantId, user);
    }
    recordPreCheck(dto, req) {
        const user = {
            id: req.user.id,
            full_name: req.user.full_name,
            role: req.user.role,
            tenant_id: req.tenantId,
        };
        return this.queueService.recordPreCheck(dto, req.tenantId, user);
    }
};
exports.QueueController = QueueController;
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [queue_dto_1.CreateQueueDto, Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('today'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('doctor_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "getTodayQueue", null);
__decorate([
    (0, common_1.Get)('today/stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "getTodayStats", null);
__decorate([
    (0, common_1.Get)(':id/precheck'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "getPreCheck", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "getById", null);
__decorate([
    (0, common_1.Patch)(':id/status'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, queue_dto_1.UpdateQueueStatusDto, Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "updateStatus", null);
__decorate([
    (0, common_1.Post)('precheck'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [queue_dto_1.RecordPreCheckDto, Object]),
    __metadata("design:returntype", void 0)
], QueueController.prototype, "recordPreCheck", null);
exports.QueueController = QueueController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, tenant_guard_1.TenantGuard),
    (0, common_1.Controller)('queue'),
    __metadata("design:paramtypes", [queue_service_1.QueueService])
], QueueController);
//# sourceMappingURL=queue.controller.js.map