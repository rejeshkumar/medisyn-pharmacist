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
exports.AiPrescriptionController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const ai_prescription_service_1 = require("./ai-prescription.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
let AiPrescriptionController = class AiPrescriptionController {
    constructor(aiService) {
        this.aiService = aiService;
    }
    async parse(file, req) {
        return this.aiService.uploadAndParse(file, req.user.id);
    }
    findAll(req) {
        return this.aiService.findAll();
    }
    findOne(id) {
        return this.aiService.findOne(id);
    }
    finalize(id, body) {
        return this.aiService.finalize(id, body.medicines);
    }
};
exports.AiPrescriptionController = AiPrescriptionController;
__decorate([
    (0, common_1.Post)('parse'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Upload prescription image and extract medicines' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AiPrescriptionController.prototype, "parse", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get recent AI prescriptions' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiPrescriptionController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Get extraction result by ID' }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], AiPrescriptionController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(':id/finalize'),
    (0, swagger_1.ApiOperation)({ summary: 'Approve extracted medicines and move to dispense cart' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AiPrescriptionController.prototype, "finalize", null);
exports.AiPrescriptionController = AiPrescriptionController = __decorate([
    (0, swagger_1.ApiTags)('AI Prescription'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('ai/prescription'),
    __metadata("design:paramtypes", [ai_prescription_service_1.AiPrescriptionService])
], AiPrescriptionController);
//# sourceMappingURL=ai-prescription.controller.js.map