import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AiCareService } from './ai-care.service';
import { AiCareController, WhatsAppWebhookController } from './ai-care.controller';
import { DailyAlertService } from './daily-alert.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [AiCareController, WhatsAppWebhookController],
  providers: [AiCareService, DailyAlertService],
  exports: [AiCareService, DailyAlertService],
})
export class AiCareModule {}
