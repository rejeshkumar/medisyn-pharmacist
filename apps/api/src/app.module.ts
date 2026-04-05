
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantGuard } from './common/guards/tenant.guard';

// Modules
import { AuthModule } from './auth/auth.module';
import { AuthService } from './auth/auth.service';
import { UsersModule } from './users/users.module';
import { MedicinesModule } from './medicines/medicines.module';
import { StockModule } from './stock/stock.module';
import { SalesModule } from './sales/sales.module';
import { AiPrescriptionModule } from './ai-prescription/ai-prescription.module';
import { SubstitutesModule } from './substitutes/substitutes.module';
import { BulkModule } from './bulk/bulk.module';
import { ComplianceModule } from './compliance/compliance.module';
import { ReportsModule } from './reports/reports.module';
import { PatientsModule } from './patients/patients.module';
import { TenantsModule } from './tenants/tenants.module';
import { AuditModule } from './audit/audit.module';
import { AiModule } from './ai/ai.module';
import { AvailabilityModule } from './availability/availability.module';
import { QueueModule } from './queue/queue.module';
import { ConsultationModule } from './consultation/consultation.module';

import { PaymentModule } from './payments/payment.module';

import { HrModule } from './hr/hr.module';
import { ReportsController } from './reports/reports.controller';
import { AiCareModule } from './ai-care/ai-care.module';
import { BillingModule } from './billing/billing.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    AiCareModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        ...(configService.get('DATABASE_URL')
          ? {
              url: configService.get('DATABASE_URL'),
              ssl: { rejectUnauthorized: false },
            }
          : {
              host:     configService.get('DB_HOST', 'localhost'),
              port:     configService.get<number>('DB_PORT', 5432),
              username: configService.get('DB_USERNAME', 'postgres'),
              password: configService.get('DB_PASSWORD', ''),
              database: configService.get('DB_DATABASE', 'medisyn') as string,
            }),
        autoLoadEntities: true,
        // synchronize ONLY in local dev — never in production
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: false,
      }),
    }),

    // Foundation modules (load first)
    TenantsModule,
    AuditModule,
    BillingModule,
    HrModule,
    PaymentModule,   // @Global — AuditService available everywhere without importing

    // Feature modules
    AuthModule,
    UsersModule,
    MedicinesModule,
    StockModule,
    SalesModule,
    AiPrescriptionModule,
    SubstitutesModule,
    BulkModule,
    ComplianceModule,
    ReportsModule,
    PatientsModule,
    QueueModule,
    AiModule,
    AvailabilityModule,
    ConsultationModule,
    AnalyticsModule,
  ],
  providers: [
    // Applied globally in order — JwtAuthGuard first, then TenantGuard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    const authService = this.moduleRef.get(AuthService, { strict: false });
    await authService.seedOwner();
  }
}
