import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleDrugLog]), AuditModule],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
