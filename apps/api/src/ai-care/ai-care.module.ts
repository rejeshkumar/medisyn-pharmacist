import { Module } from '@nestjs/common';
import { AiCareService } from './ai-care.service';
import { AiCareController, WhatsAppWebhookController } from './ai-care.controller';

@Module({
  controllers: [AiCareController, WhatsAppWebhookController],
  providers: [AiCareService],
  exports: [AiCareService],
})
export class AiCareModule {}
