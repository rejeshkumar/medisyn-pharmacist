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
exports.AuditController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const audit_query_service_1 = require("./audit-query.service");
const user_entity_1 = require("../database/entities/user.entity");
let AuditController = class AuditController {
    constructor(auditQueryService) {
        this.auditQueryService = auditQueryService;
    }
    getLogs(req, from, to, userId, action, entity, entityId, page, limit) {
        if (req.userRole !== user_entity_1.UserRole.OWNER) {
            throw new common_1.ForbiddenException('Audit logs are restricted to owners');
        }
        return this.auditQueryService.getLogs(req.tenantId, {
            from,
            to,
            userId,
            action,
            entity,
            entityId,
            page: page ? Number(page) : 1,
            limit: limit ? Number(limit) : 50,
        });
    }
    getSummary(req, from, to) {
        if (req.userRole !== user_entity_1.UserRole.OWNER) {
            throw new common_1.ForbiddenException('Audit logs are restricted to owners');
        }
        return this.auditQueryService.getSummary(req.tenantId, { from, to });
    }
};
exports.AuditController = AuditController;
__decorate([
    (0, common_1.Get)('logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Get audit logs (Owner only)' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false, description: 'Start date YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false, description: 'End date YYYY-MM-DD' }),
    (0, swagger_1.ApiQuery)({ name: 'user_id', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'action', required: false, description: 'e.g. DISPENSE, VOID, CREATE' }),
    (0, swagger_1.ApiQuery)({ name: 'entity', required: false, description: 'e.g. Sale, Medicine, Patient' }),
    (0, swagger_1.ApiQuery)({ name: 'entity_id', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'page', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'limit', required: false, type: Number }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('user_id')),
    __param(4, (0, common_1.Query)('action')),
    __param(5, (0, common_1.Query)('entity')),
    __param(6, (0, common_1.Query)('entity_id')),
    __param(7, (0, common_1.Query)('page')),
    __param(8, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, Number, Number]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)('summary'),
    (0, swagger_1.ApiOperation)({ summary: 'Get audit summary counts by action (Owner only)' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], AuditController.prototype, "getSummary", null);
exports.AuditController = AuditController = __decorate([
    (0, swagger_1.ApiTags)('Audit'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('audit'),
    __metadata("design:paramtypes", [audit_query_service_1.AuditQueryService])
], AuditController);
//# sourceMappingURL=audit.controller.js.map