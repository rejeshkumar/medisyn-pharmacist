import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { UpsertAvailabilityDto, AddLeaveDto } from './availability.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { DataSource } from 'typeorm';

@Controller('availability')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AvailabilityController {
  constructor(
    private readonly availService: AvailabilityService,
    private readonly dataSource: DataSource,
  ) {}

  // GET /availability/:doctorId — get weekly schedule
  @Get(':doctorId')
  getSchedule(@Param('doctorId') doctorId: string, @Req() req: any) {
    return this.availService.getSchedule(doctorId, req.user.tenant_id);
  }

  // POST /availability/:doctorId — upsert a day
  @Post(':doctorId')
  upsertDay(
    @Param('doctorId') doctorId: string,
    @Body() dto: UpsertAvailabilityDto,
    @Req() req: any,
  ) {
    return this.availService.upsertDay(doctorId, req.user.tenant_id, dto);
  }

  // DELETE /availability/:doctorId/day/:day
  @Delete(':doctorId/day/:day')
  removeDay(
    @Param('doctorId') doctorId: string,
    @Param('day') day: string,
    @Req() req: any,
  ) {
    return this.availService.removeDay(doctorId, req.user.tenant_id, parseInt(day));
  }

  // GET /availability/:doctorId/slots?date=YYYY-MM-DD
  @Get(':doctorId/slots')
  getSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
    @Req() req: any,
  ) {
    return this.availService.getSlots(doctorId, req.user.tenant_id, date, this.dataSource);
  }

  // GET /availability/:doctorId/leaves
  @Get(':doctorId/leaves')
  getLeaves(@Param('doctorId') doctorId: string, @Req() req: any) {
    return this.availService.getLeaves(doctorId, req.user.tenant_id);
  }

  // POST /availability/:doctorId/leaves
  @Post(':doctorId/leaves')
  addLeave(
    @Param('doctorId') doctorId: string,
    @Body() dto: AddLeaveDto,
    @Req() req: any,
  ) {
    return this.availService.addLeave(doctorId, req.user.tenant_id, dto);
  }

  // DELETE /availability/:doctorId/leaves/:leaveId
  @Delete(':doctorId/leaves/:leaveId')
  removeLeave(
    @Param('leaveId') leaveId: string,
    @Req() req: any,
  ) {
    return this.availService.removeLeave(leaveId, req.user.tenant_id);
  }
}
