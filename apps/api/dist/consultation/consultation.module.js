"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsultationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const consultation_entity_1 = require("./consultation.entity");
const prescription_entity_1 = require("./prescription.entity");
const prescription_item_entity_1 = require("./prescription-item.entity");
const consultation_service_1 = require("./consultation.service");
const consultation_controller_1 = require("./consultation.controller");
const queue_module_1 = require("../queue/queue.module");
let ConsultationModule = class ConsultationModule {
};
exports.ConsultationModule = ConsultationModule;
exports.ConsultationModule = ConsultationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([consultation_entity_1.Consultation, prescription_entity_1.Prescription, prescription_item_entity_1.PrescriptionItem]),
            queue_module_1.QueueModule,
        ],
        controllers: [consultation_controller_1.ConsultationController, consultation_controller_1.PrescriptionController],
        providers: [consultation_service_1.ConsultationService],
        exports: [consultation_service_1.ConsultationService],
    })
], ConsultationModule);
//# sourceMappingURL=consultation.module.js.map