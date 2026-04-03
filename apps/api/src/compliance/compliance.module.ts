import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { Form17Controller } from './form17.controller';
import { Form17Service } from './form17.service';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleDrugLog]), AuditModule],
  controllers: [ComplianceController, Form17Controller],
  providers: [ComplianceService, Form17Service],
  exports: [ComplianceService, Form17Service],
})
export class ComplianceModule {}
