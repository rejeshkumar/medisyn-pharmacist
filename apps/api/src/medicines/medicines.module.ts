import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MedicinesController } from './medicines.controller';
import { MedicinesService } from './medicines.service';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Medicine, StockBatch]), AuditModule],
  controllers: [MedicinesController],
  providers: [MedicinesService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
