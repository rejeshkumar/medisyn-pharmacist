import {
  Controller, Get, Put, Post, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DispensingService, ValidateDispenseDto } from './dispensing.service';
import { DrugCategory } from './dispense-expiry-rule.entity';

@Controller('dispensing')
@UseGuards(AuthGuard('jwt'))
export class DispensingController {
  constructor(private readonly dispensingService: DispensingService) {}

  // GET /dispensing/rules
  @Get('rules')
  getRules(@Request() req: any) {
    return this.dispensingService.getRules(req.user.tenant_id);
  }

  // PUT /dispensing/rules/:category
  @Put('rules/:category')
  updateRule(
    @Request() req: any,
    @Param('category') category: DrugCategory,
    @Body() body: { hard_stop_days?: number; warning_days?: number; safety_buffer_days?: number },
  ) {
    return this.dispensingService.updateRule(req.user.tenant_id, category, body);
  }

  // GET /dispensing/batches?medicine_id=&course_days=
  @Get('batches')
  getBatches(
    @Request() req: any,
    @Query('medicine_id') medicineId: string,
    @Query('course_days') courseDays?: string,
  ) {
    return this.dispensingService.getBatchesWithValidation(
      req.user.tenant_id,
      medicineId,
      courseDays ? parseInt(courseDays, 10) : undefined,
    );
  }

  // POST /dispensing/validate
  @Post('validate')
  validate(
    @Request() req: any,
    @Body() dto: ValidateDispenseDto,
  ) {
    return this.dispensingService.validateDispense(req.user.tenant_id, dto);
  }

  // GET /dispensing/audit-log
  @Get('audit-log')
  getAuditLog(
    @Request() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('medicine_id') medicineId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dispensingService.getAuditLog(
      req.user.tenant_id,
      { from, to, status, medicine_id: medicineId },
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
