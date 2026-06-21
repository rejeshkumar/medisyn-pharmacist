import { Module } from '@nestjs/common';
import { SuperRxController } from './superrx.controller';
import { SuperRxService } from './superrx.service';

/**
 * Register this by adding `SuperRxModule` to the `imports` array in
 * SimpliRx's app.module.ts (apps/api/src/app.module.ts).
 *
 * No database tables and no migrations are needed — this module only forwards
 * requests to SuperRx.
 */
@Module({
  controllers: [SuperRxController],
  providers: [SuperRxService],
})
export class SuperRxModule {}
