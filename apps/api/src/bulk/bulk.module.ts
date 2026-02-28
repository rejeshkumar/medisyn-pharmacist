import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { BulkController } from './bulk.controller';
import { BulkService } from './bulk.service';
import { BulkActivityLog } from '../database/entities/bulk-activity-log.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { diskStorage } from 'multer';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Module({
  imports: [
    TypeOrmModule.forFeature([BulkActivityLog, Medicine, StockBatch, Supplier]),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'bulk');
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          cb(null, `bulk-${Date.now()}-${file.originalname}`);
        },
      }),
    }),
  ],
  controllers: [BulkController],
  providers: [BulkService],
})
export class BulkModule {}
