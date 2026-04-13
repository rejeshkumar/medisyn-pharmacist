import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { Financial3Controller } from './financial3.controller';
import { Financial2Controller } from './financial2.controller';
import { DayCloseController } from './day-close.controller';

@Module({
  controllers: [FinancialController, Financial2Controller, DayCloseController],
})
export class FinancialModule {}
