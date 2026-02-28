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
exports.StockController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const stock_service_1 = require("./stock.service");
const add_purchase_dto_1 = require("./dto/add-purchase.dto");
const adjust_stock_dto_1 = require("./dto/adjust-stock.dto");
const create_supplier_dto_1 = require("./dto/create-supplier.dto");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../common/guards/roles.guard");
const roles_decorator_1 = require("../common/decorators/roles.decorator");
const user_entity_1 = require("../database/entities/user.entity");
let StockController = class StockController {
    constructor(stockService) {
        this.stockService = stockService;
    }
    getStockList(search, expiryDays, lowStock, scheduleClass, supplierId, molecule, category) {
        return this.stockService.getStockList({
            search,
            expiryDays: expiryDays ? Number(expiryDays) : undefined,
            lowStock: lowStock === true || lowStock === 'true',
            scheduleClass,
            supplierId,
            molecule,
            category,
        });
    }
    getLowStockAlerts(threshold) {
        return this.stockService.getLowStockAlerts(threshold ? Number(threshold) : 10);
    }
    getNearExpiryAlerts(days) {
        return this.stockService.getNearExpiryAlerts(days ? Number(days) : 90);
    }
    getSuppliers() {
        return this.stockService.getSuppliers();
    }
    createSupplier(dto) {
        return this.stockService.createSupplier(dto);
    }
    getBatches(medicineId) {
        return this.stockService.getBatchesForMedicine(medicineId);
    }
    getBestBatch(medicineId) {
        return this.stockService.getBestBatch(medicineId);
    }
    addPurchase(dto, req) {
        return this.stockService.addPurchase(dto, req.user.id);
    }
    adjustStock(dto, req) {
        return this.stockService.adjustStock(dto, req.user.id);
    }
};
exports.StockController = StockController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get stock list with filters' }),
    (0, swagger_1.ApiQuery)({ name: 'search', required: false }),
    (0, swagger_1.ApiQuery)({ name: 'expiry_days', required: false, type: Number }),
    (0, swagger_1.ApiQuery)({ name: 'low_stock', required: false, type: Boolean }),
    (0, swagger_1.ApiQuery)({ name: 'schedule_class', required: false }),
    __param(0, (0, common_1.Query)('search')),
    __param(1, (0, common_1.Query)('expiry_days')),
    __param(2, (0, common_1.Query)('low_stock')),
    __param(3, (0, common_1.Query)('schedule_class')),
    __param(4, (0, common_1.Query)('supplier_id')),
    __param(5, (0, common_1.Query)('molecule')),
    __param(6, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Boolean, String, String, String, String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getStockList", null);
__decorate([
    (0, common_1.Get)('alerts/low-stock'),
    (0, swagger_1.ApiOperation)({ summary: 'Get low stock alerts' }),
    __param(0, (0, common_1.Query)('threshold')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getLowStockAlerts", null);
__decorate([
    (0, common_1.Get)('alerts/near-expiry'),
    (0, swagger_1.ApiOperation)({ summary: 'Get near expiry alerts' }),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getNearExpiryAlerts", null);
__decorate([
    (0, common_1.Get)('suppliers'),
    (0, swagger_1.ApiOperation)({ summary: 'List all suppliers' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getSuppliers", null);
__decorate([
    (0, common_1.Post)('suppliers'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a supplier' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_supplier_dto_1.CreateSupplierDto]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "createSupplier", null);
__decorate([
    (0, common_1.Get)(':medicine_id/batches'),
    (0, swagger_1.ApiOperation)({ summary: 'Get batches for a medicine' }),
    __param(0, (0, common_1.Param)('medicine_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getBatches", null);
__decorate([
    (0, common_1.Get)(':medicine_id/best-batch'),
    (0, swagger_1.ApiOperation)({ summary: 'Get best batch (nearest safe expiry)' }),
    __param(0, (0, common_1.Param)('medicine_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "getBestBatch", null);
__decorate([
    (0, common_1.Post)('purchase'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER, user_entity_1.UserRole.PHARMACIST),
    (0, swagger_1.ApiOperation)({ summary: 'Add stock via purchase invoice' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [add_purchase_dto_1.AddPurchaseDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "addPurchase", null);
__decorate([
    (0, common_1.Post)('adjust'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.OWNER, user_entity_1.UserRole.PHARMACIST),
    (0, swagger_1.ApiOperation)({ summary: 'Adjust stock (expiry/damage/sample)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [adjust_stock_dto_1.AdjustStockDto, Object]),
    __metadata("design:returntype", void 0)
], StockController.prototype, "adjustStock", null);
exports.StockController = StockController = __decorate([
    (0, swagger_1.ApiTags)('Stock'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('stock'),
    __metadata("design:paramtypes", [stock_service_1.StockService])
], StockController);
//# sourceMappingURL=stock.controller.js.map