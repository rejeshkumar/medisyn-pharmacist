import { Module } from '@nestjs/common';
import { OwnerDashboardController } from './owner-dashboard.controller';

@Module({
  controllers: [OwnerDashboardController],
})
export class OwnerDashboardModule {}
