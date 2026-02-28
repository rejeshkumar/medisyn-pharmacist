import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ComplianceController } from './compliance.controller';
import { ComplianceService } from './compliance.service';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScheduleDrugLog])],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
