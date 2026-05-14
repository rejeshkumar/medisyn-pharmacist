import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalesAgentsService } from './sales-agents.service';
import { SalesAgentsController } from './sales-agents.controller';
import { SalesAgent } from '../database/entities/sales-agent.entity';
import { VipRegistration } from '../database/entities/vip-registration.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SalesAgent, VipRegistration])],
  providers: [SalesAgentsService],
  controllers: [SalesAgentsController],
  exports: [SalesAgentsService],
})
export class SalesAgentsModule {}
