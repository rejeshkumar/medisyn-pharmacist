"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiPrescriptionModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const platform_express_1 = require("@nestjs/platform-express");
const ai_prescription_controller_1 = require("./ai-prescription.controller");
const ai_prescription_service_1 = require("./ai-prescription.service");
const ai_prescription_entity_1 = require("../database/entities/ai-prescription.entity");
const medicine_entity_1 = require("../database/entities/medicine.entity");
const multer_1 = require("multer");
const path_1 = require("path");
const fs_1 = require("fs");
let AiPrescriptionModule = class AiPrescriptionModule {
};
exports.AiPrescriptionModule = AiPrescriptionModule;
exports.AiPrescriptionModule = AiPrescriptionModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([ai_prescription_entity_1.AiPrescription, medicine_entity_1.Medicine]),
            platform_express_1.MulterModule.register({
                storage: (0, multer_1.diskStorage)({
                    destination: (req, file, cb) => {
                        const uploadPath = (0, path_1.join)(process.cwd(), 'uploads', 'prescriptions');
                        if (!(0, fs_1.existsSync)(uploadPath))
                            (0, fs_1.mkdirSync)(uploadPath, { recursive: true });
                        cb(null, uploadPath);
                    },
                    filename: (req, file, cb) => {
                        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
                        cb(null, `rx-${uniqueSuffix}${(0, path_1.extname)(file.originalname)}`);
                    },
                }),
                fileFilter: (req, file, cb) => {
                    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
                    const ext = (0, path_1.extname)(file.originalname).toLowerCase();
                    if (allowed.includes(ext)) {
                        cb(null, true);
                    }
                    else {
                        cb(new Error('Only JPG, PNG and PDF files allowed'), false);
                    }
                },
                limits: { fileSize: 15 * 1024 * 1024 },
            }),
        ],
        controllers: [ai_prescription_controller_1.AiPrescriptionController],
        providers: [ai_prescription_service_1.AiPrescriptionService],
        exports: [ai_prescription_service_1.AiPrescriptionService],
    })
], AiPrescriptionModule);
//# sourceMappingURL=ai-prescription.module.js.map