import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from './queue.entity';
import { PreCheck } from './pre-check.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Queue, PreCheck]), AuditModule],
  controllers: [QueueController],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
