import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { ClinicBill, ClinicBillItem } from './clinic-bill.entity';
import { VipTierConfig } from './vip-tier.entity';
import { DoctorRateConfig } from './doctor-rate-config.entity';
import { ServiceRate } from './service-rate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicBill,
      ClinicBillItem,
      VipTierConfig,
      DoctorRateConfig,
      ServiceRate,
    ]),
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
