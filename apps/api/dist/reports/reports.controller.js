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
exports.ReportsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const reports_service_1 = require("./reports.service");
let ReportsController = class ReportsController {
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    getDashboard(req) {
        return this.reportsService.getDashboard(req.tenantId);
    }
    getDailySales(req, date) {
        return this.reportsService.getDailySales(req.tenantId, date);
    }
    getPeriodSales(req, from, to) {
        return this.reportsService.getPeriodSales(req.tenantId, from, to);
    }
    getTopMedicines(req, from, to) {
        return this.reportsService.getTopMedicines(req.tenantId, from, to);
    }
    getLowStock(req) {
        return this.reportsService.getLowStockReport(req.tenantId);
    }
    getNearExpiry(req, days) {
        return this.reportsService.getNearExpiryReport(req.tenantId, days ? Number(days) : 90);
    }
    getStockValuation(req) {
        return this.reportsService.getStockValuation(req.tenantId);
    }
    async exportSales(req, from, to, res) {
        const buffer = await this.reportsService.exportSalesToExcel(req.tenantId, from, to);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sales-report-${from}-to-${to}.xlsx`);
        res.send(buffer);
    }
};
exports.ReportsController = ReportsController;
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, swagger_1.ApiOperation)({ summary: 'Get owner dashboard KPIs' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getDashboard", null);
__decorate([
    (0, common_1.Get)('daily-sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Get daily sales summary' }),
    (0, swagger_1.ApiQuery)({ name: 'date', required: false }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('date')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getDailySales", null);
__decorate([
    (0, common_1.Get)('period-sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Get sales for a date range' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: true }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: true }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getPeriodSales", null);
__decorate([
    (0, common_1.Get)('top-medicines'),
    (0, swagger_1.ApiOperation)({ summary: 'Get top selling medicines' }),
    (0, swagger_1.ApiQuery)({ name: 'from', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'to', required: false }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getTopMedicines", null);
__decorate([
    (0, common_1.Get)('low-stock'),
    (0, swagger_1.ApiOperation)({ summary: 'Get low stock medicines' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getLowStock", null);
__decorate([
    (0, common_1.Get)('near-expiry'),
    (0, swagger_1.ApiOperation)({ summary: 'Get near expiry batches' }),
    (0, swagger_1.ApiQuery)({ name: 'days', required: false, type: Number }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getNearExpiry", null);
__decorate([
    (0, common_1.Get)('stock-valuation'),
    (0, swagger_1.ApiOperation)({ summary: 'Get stock valuation report' }),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ReportsController.prototype, "getStockValuation", null);
__decorate([
    (0, common_1.Get)('export/sales'),
    (0, swagger_1.ApiOperation)({ summary: 'Export sales report to Excel' }),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "exportSales", null);
exports.ReportsController = ReportsController = __decorate([
    (0, swagger_1.ApiTags)('Reports'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('reports'),
    __metadata("design:paramtypes", [reports_service_1.ReportsService])
], ReportsController);
//# sourceMappingURL=reports.controller.js.map