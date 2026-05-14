import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SalesAgentsService } from './sales-agents.service';

@ApiTags('sales-agents')
@ApiBearerAuth()
@Controller('sales-agents')
export class SalesAgentsController {
  constructor(private readonly service: SalesAgentsService) {}

  @Get('dashboard')
  getDashboard(@Request() req) {
    return this.service.getSalesDashboard(req.tenantId);
  }

  @Get('performance')
  getPerformance(@Request() req) {
    return this.service.getAgentPerformance(req.tenantId);
  }
}
