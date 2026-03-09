"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StockModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const stock_controller_1 = require("./stock.controller");
const stock_service_1 = require("./stock.service");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const stock_adjustment_entity_1 = require("../database/entities/stock-adjustment.entity");
const supplier_entity_1 = require("../database/entities/supplier.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
let StockModule = class StockModule {
};
exports.StockModule = StockModule;
exports.StockModule = StockModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([stock_batch_entity_1.StockBatch, stock_adjustment_entity_1.StockAdjustment, supplier_entity_1.Supplier, medicine_entity_1.Medicine])],
        controllers: [stock_controller_1.StockController],
        providers: [stock_service_1.StockService],
        exports: [stock_service_1.StockService],
    })
], StockModule);
//# sourceMappingURL=stock.module.js.map