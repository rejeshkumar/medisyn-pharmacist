import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../database/entities/payment.entity';
import { Queue } from '../queue/queue.entity';
import { User } from '../database/entities/user.entity';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, Queue, User]), AuditModule],
  providers: [PaymentService],
  controllers: [PaymentController],
  exports: [PaymentService],
})
export class PaymentModule {}
