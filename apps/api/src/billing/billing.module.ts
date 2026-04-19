import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { ClinicBill, ClinicBillItem } from './clinic-bill.entity';
import { VipTierConfig } from './vip-tier.entity';
import { DoctorRateConfig } from './doctor-rate-config.entity';
import { ServiceRate } from './service-rate.entity';
import { EncounterService } from './encounter-service.entity';
import { EncounterServicesService } from './encounter.service';
import { EncounterController } from './encounter.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicBill,
      ClinicBillItem,
      VipTierConfig,
      DoctorRateConfig,
      ServiceRate,
      EncounterService,
    ]),
  ],
  providers: [BillingService, EncounterServicesService],
  controllers: [BillingController, EncounterController],
  exports: [BillingService, EncounterServicesService],
})
export class BillingModule {}
