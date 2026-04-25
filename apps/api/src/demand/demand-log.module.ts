// ============================================================
// apps/api/src/demand/demand-log.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { DemandLogController } from './demand-log.controller';
import { DemandLogService } from './demand-log.service';

@Module({
  controllers: [DemandLogController],
  providers: [DemandLogService],
  exports: [DemandLogService],
})
export class DemandLogModule {}
