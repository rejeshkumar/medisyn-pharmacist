"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubstitutesModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const substitutes_controller_1 = require("./substitutes.controller");
const substitutes_service_1 = require("./substitutes.service");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
let SubstitutesModule = class SubstitutesModule {
};
exports.SubstitutesModule = SubstitutesModule;
exports.SubstitutesModule = SubstitutesModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([medicine_entity_1.Medicine, stock_batch_entity_1.StockBatch])],
        controllers: [substitutes_controller_1.SubstitutesController],
        providers: [substitutes_service_1.SubstitutesService],
        exports: [substitutes_service_1.SubstitutesService],
    })
], SubstitutesModule);
//# sourceMappingURL=substitutes.module.js.map