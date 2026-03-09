"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const platform_express_1 = require("@nestjs/platform-express");
const bulk_controller_1 = require("./bulk.controller");
const bulk_service_1 = require("./bulk.service");
const bulk_activity_log_entity_1 = require("../database/entities/bulk-activity-log.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const stock_batch_entity_1 = require("../database/entities/stock-batch.entity");
const supplier_entity_1 = require("../database/entities/supplier.entity");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
let BulkModule = class BulkModule {
};
exports.BulkModule = BulkModule;
exports.BulkModule = BulkModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([bulk_activity_log_entity_1.BulkActivityLog, medicine_entity_1.Medicine, stock_batch_entity_1.StockBatch, supplier_entity_1.Supplier]),
            platform_express_1.MulterModule.register({
                storage: (0, multer_1.diskStorage)({
                    destination: (req, file, cb) => {
                        const uploadPath = (0, path_1.join)(process.cwd(), 'uploads', 'bulk');
                        if (!(0, fs_1.existsSync)(uploadPath))
                            (0, fs_1.mkdirSync)(uploadPath, { recursive: true });
                        cb(null, uploadPath);
                    },
                    filename: (req, file, cb) => {
                        cb(null, `bulk-${Date.now()}-${file.originalname}`);
                    },
                }),
            }),
        ],
        controllers: [bulk_controller_1.BulkController],
        providers: [bulk_service_1.BulkService],
    })
], BulkModule);
//# sourceMappingURL=bulk.module.js.map