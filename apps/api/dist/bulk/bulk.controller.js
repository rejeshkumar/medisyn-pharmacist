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
exports.BulkController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const bulk_service_1 = require("./bulk.service");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../database/entities/user.entity");
let BulkController = class BulkController {
    constructor(bulkService) {
        this.bulkService = bulkService;
    }
    async getMedicineTemplate(res) {
        const buffer = await this.bulkService.getMedicineTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=medicine-import-template.xlsx');
        res.send(buffer);
    }
    async getStockTemplate(res) {
        const buffer = await this.bulkService.getStockTemplate();
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=stock-import-template.xlsx');
        res.send(buffer);
    }
    importMedicines(file, req) {
        return this.bulkService.importMedicines(file.path, file.originalname, req.user.id);
    }
    importStock(file, req) {
        return this.bulkService.importStock(file.path, file.originalname, req.user.id);
    }
    parseInvoice(file) {
        if (!file)
            throw new Error('No file uploaded');
        return this.bulkService.parseInvoicePdf(file.path);
    }
    importInvoice(body, req) {
        const { items, supplier, invoiceNo } = body;
        return this.bulkService.importInvoiceItems(items, supplier, invoiceNo, req.user.id);
    }
    getLogs(req) {
        return this.bulkService.getLogs();
    }
};
exports.BulkController = BulkController;
__decorate([
    (0, common_1.Get)('template/medicines'),
    (0, swagger_1.ApiOperation)({ summary: 'Download medicine master import template' }),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BulkController.prototype, "getMedicineTemplate", null);
__decorate([
    (0, common_1.Get)('template/stock'),
    (0, swagger_1.ApiOperation)({ summary: 'Download stock batch import template' }),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BulkController.prototype, "getStockTemplate", null);
__decorate([
    (0, common_1.Post)('medicines/import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Import medicine master from Excel' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BulkController.prototype, "importMedicines", null);
__decorate([
    (0, common_1.Post)('stock/import'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Import stock batches from Excel' }),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BulkController.prototype, "importStock", null);
__decorate([
    (0, common_1.Post)('invoice/parse'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, swagger_1.ApiOperation)({ summary: 'Parse a supplier PDF invoice and extract medicine/stock data' }),
    __param(0, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BulkController.prototype, "parseInvoice", null);
__decorate([
    (0, common_1.Post)('invoice/import'),
    (0, swagger_1.ApiOperation)({ summary: 'Import reviewed invoice items into stock' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], BulkController.prototype, "importInvoice", null);
__decorate([
    (0, common_1.Get)('logs'),
    (0, swagger_1.ApiOperation)({ summary: 'Get bulk activity logs' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], BulkController.prototype, "getLogs", null);
exports.BulkController = BulkController = __decorate([
    (0, swagger_1.ApiTags)('Bulk Upload'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER),
    (0, common_1.Controller)('bulk'),
    __metadata("design:paramtypes", [bulk_service_1.BulkService])
], BulkController);
//# sourceMappingURL=bulk.controller.js.map