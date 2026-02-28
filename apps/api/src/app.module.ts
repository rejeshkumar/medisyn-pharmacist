import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModuleRef } from '@nestjs/core';
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

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'password'),
        database: configService.get('DB_DATABASE', 'medisyn'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') !== 'production',
        logging: false,
      }),
      inject: [ConfigService],
    }),
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
  ],
})
export class AppModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {}

  async onModuleInit() {
    const authService = this.moduleRef.get(AuthService, { strict: false });
    await authService.seedOwner();
  }
}
