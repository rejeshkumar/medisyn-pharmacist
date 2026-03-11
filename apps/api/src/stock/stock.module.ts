import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([StockBatch, StockAdjustment, Supplier, Medicine]), AuditModule],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
