import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Consultation } from './consultation.entity';
import { Prescription } from './prescription.entity';
import { PrescriptionItem } from './prescription-item.entity';
import { ConsultationService } from './consultation.service';
import { ConsultationController, PrescriptionController } from './consultation.controller';
import { QueueModule } from '../queue/queue.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Consultation, Prescription, PrescriptionItem]),
    QueueModule,
    AuditModule,
  ],
  controllers: [ConsultationController, PrescriptionController],
  providers: [ConsultationService],
  exports: [ConsultationService],
})
export class ConsultationModule {}
