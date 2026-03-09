import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';
import { AuditService } from './audit.service';
import { AuditQueryService } from './audit-query.service';
import { AuditController } from './audit.controller';

// @Global() makes AuditService injectable in ALL modules
// without needing to import AuditModule everywhere
@Global()
@Module({
  imports:     [TypeOrmModule.forFeature([AuditLog])],
  providers:   [AuditService, AuditQueryService],
  exports:     [AuditService, AuditQueryService],
  controllers: [AuditController],
})
export class AuditModule {}
