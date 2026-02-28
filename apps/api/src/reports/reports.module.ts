import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Sale, SaleItem, StockBatch, Medicine])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
