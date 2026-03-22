import { Module } from '@nestjs/common';
import { LeaveNotificationService } from './leave-notification.service';
import { HrService } from './hr.service';
import { HrController } from './hr.controller';

@Module({
  imports: [],
  providers: [HrService, LeaveNotificationService],
  controllers: [HrController],
  exports: [HrService],
})
export class HrModule {}
