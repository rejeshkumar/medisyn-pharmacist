import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DraftBillsController } from './draft-bills.controller';
import { MedicinesController } from './medicines.controller';
import { MoleculeSuggestionsController } from './molecule-suggestions.controller';
import { BarcodeScanController } from './barcode-scan.controller';
import { MedicinesService } from './medicines.service';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Medicine, StockBatch]), AuditModule],
  controllers: [MedicinesController, DraftBillsController, MoleculeSuggestionsController, BarcodeScanController],
  providers: [MedicinesService],
  exports: [MedicinesService],
})
export class MedicinesModule {}
