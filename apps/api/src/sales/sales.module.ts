import { DispensingModule } from "../dispensing/dispensing.module";
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { CreditNoteController } from './credit-note.controller';
import { CreditNoteService } from './credit-note.service';
import { PendingReceptionController } from './pending-reception.controller';
import { PendingReceptionService } from './pending-reception.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { AuditModule } from '../audit/audit.module';
import { AutoCarePlanService } from '../ai-care/auto-care-plan.service';
import { WhatsAppTemplateService } from '../common/whatsapp-template.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Sale, SaleItem, StockBatch, Medicine, ScheduleDrugLog, Tenant]),
    AuditModule,
    DispensingModule,
  ],
  controllers: [SalesController, CreditNoteController, PendingReceptionController],
  providers: [SalesService, CreditNoteService, PendingReceptionService, AutoCarePlanService, WhatsAppTemplateService],
  exports: [SalesService],
})
export class SalesModule {}
