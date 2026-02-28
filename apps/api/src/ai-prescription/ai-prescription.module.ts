import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { AiPrescriptionController } from './ai-prescription.controller';
import { AiPrescriptionService } from './ai-prescription.service';
import { AiPrescription } from '../database/entities/ai-prescription.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiPrescription, Medicine]),
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'prescriptions');
          if (!existsSync(uploadPath)) mkdirSync(uploadPath, { recursive: true });
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `rx-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
        const ext = extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) {
          cb(null, true);
        } else {
          cb(new Error('Only JPG, PNG and PDF files allowed'), false);
        }
      },
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  ],
  controllers: [AiPrescriptionController],
  providers: [AiPrescriptionService],
  exports: [AiPrescriptionService],
})
export class AiPrescriptionModule {}
