import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispensingController } from './dispensing.controller';
import { DispensingService } from './dispensing.service';
import { DispenseExpiryRule } from './dispense-expiry-rule.entity';
import { DispenseAuditLog } from './dispense-audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DispenseExpiryRule, DispenseAuditLog]),
  ],
  controllers: [DispensingController],
  providers: [DispensingService],
  exports: [DispensingService], // exported so sales.service.ts can inject it
})
export class DispensingModule {}
