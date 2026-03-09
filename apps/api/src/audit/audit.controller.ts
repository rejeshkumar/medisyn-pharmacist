import {
  Controller,
  Get,
  Query,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuditQueryService } from './audit-query.service';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
export class AuditController {
  constructor(private readonly auditQueryService: AuditQueryService) {}

  @Get('logs')
  @ApiOperation({ summary: 'Get audit logs (Owner only)' })
  @ApiQuery({ name: 'from',        required: false, description: 'Start date YYYY-MM-DD' })
  @ApiQuery({ name: 'to',          required: false, description: 'End date YYYY-MM-DD' })
  @ApiQuery({ name: 'user_id',     required: false })
  @ApiQuery({ name: 'action',      required: false, description: 'e.g. DISPENSE, VOID, CREATE' })
  @ApiQuery({ name: 'entity',      required: false, description: 'e.g. Sale, Medicine, Patient' })
  @ApiQuery({ name: 'entity_id',   required: false })
  @ApiQuery({ name: 'page',        required: false, type: Number })
  @ApiQuery({ name: 'limit',       required: false, type: Number })
  getLogs(
    @Request() req,
    @Query('from')      from?:     string,
    @Query('to')        to?:       string,
    @Query('user_id')   userId?:   string,
    @Query('action')    action?:   string,
    @Query('entity')    entity?:   string,
    @Query('entity_id') entityId?: string,
    @Query('page')      page?:     number,
    @Query('limit')     limit?:    number,
  ) {
    if (req.userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Audit logs are restricted to owners');
    }

    return this.auditQueryService.getLogs(req.tenantId, {
      from,
      to,
      userId,
      action,
      entity,
      entityId,
      page:  page  ? Number(page)  : 1,
      limit: limit ? Number(limit) : 50,
    });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get audit summary counts by action (Owner only)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to',   required: false })
  getSummary(
    @Request() req,
    @Query('from') from?: string,
    @Query('to')   to?:   string,
  ) {
    if (req.userRole !== UserRole.OWNER) {
      throw new ForbiddenException('Audit logs are restricted to owners');
    }

    return this.auditQueryService.getSummary(req.tenantId, { from, to });
  }
}
