import { Module } from '@nestjs/common';
import { FinancialController } from './financial.controller';
import { Financial2Controller } from './financial2.controller';

@Module({
  controllers: [FinancialController, Financial2Controller],
})
export class FinancialModule {}
