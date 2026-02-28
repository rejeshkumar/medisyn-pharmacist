import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubstitutesController } from './substitutes.controller';
import { SubstitutesService } from './substitutes.service';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Medicine, StockBatch])],
  controllers: [SubstitutesController],
  providers: [SubstitutesService],
  exports: [SubstitutesService],
})
export class SubstitutesModule {}
