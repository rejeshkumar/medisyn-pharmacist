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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@nestjs/core");
const auth_module_1 = require("./auth/auth.module");
const auth_service_1 = require("./auth/auth.service");
const users_module_1 = require("./users/users.module");
const medicines_module_1 = require("./medicines/medicines.module");
const stock_module_1 = require("./stock/stock.module");
const sales_module_1 = require("./sales/sales.module");
const ai_prescription_module_1 = require("./ai-prescription/ai-prescription.module");
const substitutes_module_1 = require("./substitutes/substitutes.module");
const bulk_module_1 = require("./bulk/bulk.module");
const compliance_module_1 = require("./compliance/compliance.module");
const reports_module_1 = require("./reports/reports.module");
const patients_module_1 = require("./patients/patients.module");
let AppModule = class AppModule {
    constructor(moduleRef) {
        this.moduleRef = moduleRef;
    }
    async onModuleInit() {
        const authService = this.moduleRef.get(auth_service_1.AuthService, { strict: false });
        await authService.seedOwner();
    }
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRootAsync({
                imports: [config_1.ConfigModule],
                useFactory: (configService) => ({
                    type: 'postgres',
                    host: configService.get('DB_HOST', 'localhost'),
                    port: configService.get('DB_PORT', 5432),
                    username: configService.get('DB_USERNAME', 'postgres'),
                    password: configService.get('DB_PASSWORD', 'password'),
                    database: configService.get('DB_DATABASE', 'medisyn'),
                    autoLoadEntities: true,
                    synchronize: configService.get('NODE_ENV') !== 'production',
                    logging: false,
                }),
                inject: [config_1.ConfigService],
            }),
            auth_module_1.AuthModule,
            users_module_1.UsersModule,
            medicines_module_1.MedicinesModule,
            stock_module_1.StockModule,
            sales_module_1.SalesModule,
            ai_prescription_module_1.AiPrescriptionModule,
            substitutes_module_1.SubstitutesModule,
            bulk_module_1.BulkModule,
            compliance_module_1.ComplianceModule,
            reports_module_1.ReportsModule,
            patients_module_1.PatientsModule,
        ],
    }),
    __metadata("design:paramtypes", [core_1.ModuleRef])
], AppModule);
//# sourceMappingURL=app.module.js.map