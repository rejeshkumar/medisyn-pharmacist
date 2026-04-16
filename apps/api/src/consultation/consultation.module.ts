import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from './consultation.entity';
import { Prescription } from './prescription.entity';
import { PrescriptionItem } from './prescription-item.entity';
import { ConsultationBill } from './consultation-bill.entity';
import { ConsultationService } from './consultation.service';
import { ConsultationBillService } from './consultation-bill.service';
import { ConsultationController, PrescriptionController } from './consultation.controller';
import { ConsultationBillController } from './consultation-bill.controller';
import { QueueModule } from '../queue/queue.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Prescription, PrescriptionItem, ConsultationBill]),
    QueueModule,
    AuditModule,
  ],
  controllers: [ConsultationController, PrescriptionController, ConsultationBillController],
  providers: [ConsultationService, ConsultationBillService],
  exports: [ConsultationService, ConsultationBillService],
})
export class ConsultationModule {}
