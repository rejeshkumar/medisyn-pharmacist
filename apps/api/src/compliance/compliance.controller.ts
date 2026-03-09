import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  Request,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ComplianceService } from './compliance.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Compliance')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.OWNER, UserRole.PHARMACIST)
@Controller('compliance')
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Get('log')
  @ApiOperation({ summary: 'Get Schedule Drug Register' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'doctor_name', required: false })
  @ApiQuery({ name: 'medicine', required: false })
  @ApiQuery({ name: 'schedule_class', required: false })
  getLog(
    @Request() req,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('doctor_name') doctorName?: string,
    @Query('medicine') medicine?: string,
    @Query('schedule_class') scheduleClass?: string,
  ) {
    return this.complianceService.getScheduleDrugLog(req.tenantId, {
      from,
      to,
      doctorName,
      medicine,
      scheduleClass,
    });
  }

  @Get('log/export')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Export Schedule Drug Register to Excel (Owner only)' })
  async exportLog(
    @Request() req,
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.complianceService.exportToExcel(
      req.tenantId,
      { from, to },
      req.user,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=schedule-drug-register-${new Date().toISOString().split('T')[0]}.xlsx`,
    );
    res.send(buffer);
  }
}
