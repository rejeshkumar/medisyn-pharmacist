import {
  Controller, Get, Post, Patch, Body, Param, Query, Req, UseGuards, Res,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { HrService } from './hr.service';
import { Response } from 'express';

@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
export class HrController {
  constructor(private readonly hr: HrService) {}

  // ── Shifts ───────────────────────────────────────────────────
  @Get('hr/shifts')
  getShifts(@Req() req: any) {
    return this.hr.getShifts(req.user.tenant_id);
  }

  @Post('hr/shifts')
  upsertShift(@Body() body: any, @Req() req: any) {
    return this.hr.upsertShift(req.user.tenant_id, body);
  }

  // ── Roster ───────────────────────────────────────────────────
  @Get('hr/roster')
  getRoster(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('user_id') userId: string,
    @Req() req: any,
  ) {
    return this.hr.getRoster(req.user.tenant_id, from, to, userId);
  }

  @Post('hr/roster')
  upsertRoster(@Body() body: any, @Req() req: any) {
    return this.hr.upsertRosterEntry(req.user.tenant_id, body, req.user.sub);
  }

  @Post('hr/roster/bulk')
  bulkRoster(@Body() body: { entries: any[] }, @Req() req: any) {
    return this.hr.bulkRoster(req.user.tenant_id, body.entries, req.user.sub);
  }

  // ── Leave balance ────────────────────────────────────────────
  @Get('hr/leave-balance')
  getMyBalance(
    @Query('year') year: string,
    @Req() req: any,
  ) {
    return this.hr.getLeaveBalance(
      req.user.tenant_id, req.user.sub, year ? Number(year) : undefined,
    );
  }

  @Get('hr/leave-balance/:userId')
  getBalance(
    @Param('userId') userId: string,
    @Query('year') year: string,
    @Req() req: any,
  ) {
    return this.hr.getLeaveBalance(
      req.user.tenant_id, userId, year ? Number(year) : undefined,
    );
  }

  // ── Leave requests ───────────────────────────────────────────
  @Get('hr/leaves')
  getLeaves(@Query() query: any, @Req() req: any) {
    const isOwner = ['owner'].includes(req.user.role);
    return this.hr.getLeaves(req.user.tenant_id, {
      userId:  isOwner ? query.user_id : req.user.sub,
      status:  query.status,
      month:   query.month,
    });
  }

  @Post('hr/leaves')
  applyLeave(@Body() body: any, @Req() req: any) {
    return this.hr.applyLeave(req.user.tenant_id, req.user.sub, body);
  }

  @Patch('hr/leaves/:id/approve')
  approveLeave(@Param('id') id: string, @Req() req: any) {
    if (!['owner'].includes(req.user.role)) {
      throw new Error('Only owner can approve leaves');
    }
    return this.hr.approveRejectLeave(
      req.user.tenant_id, id, 'approved', req.user.sub,
    );
  }

  @Patch('hr/leaves/:id/reject')
  rejectLeave(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @Req() req: any,
  ) {
    if (!['owner'].includes(req.user.role)) {
      throw new Error('Only owner can reject leaves');
    }
    return this.hr.approveRejectLeave(
      req.user.tenant_id, id, 'rejected', req.user.sub, body.note,
    );
  }

  // ── Attendance ───────────────────────────────────────────────
  @Post('hr/attendance/check-in')
  checkIn(@Body() body: any, @Req() req: any) {
    return this.hr.checkIn(req.user.tenant_id, req.user.sub, body.notes);
  }

  @Post('hr/attendance/check-out')
  checkOut(@Req() req: any) {
    return this.hr.checkOut(req.user.tenant_id, req.user.sub);
  }

  @Get('hr/attendance')
  getAttendance(@Query() query: any, @Req() req: any) {
    const isOwner = ['owner'].includes(req.user.role);
    return this.hr.getAttendance(req.user.tenant_id, {
      userId: isOwner ? query.user_id : req.user.sub,
      from:   query.from,
      to:     query.to,
    });
  }

  @Get('hr/today')
  getTodayStatus(@Req() req: any) {
    return this.hr.getTodayStatus(req.user.tenant_id, req.user.sub);
  }

  // ── Payroll report ───────────────────────────────────────────
  @Get('hr/payroll-report')
  getPayrollReport(
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req: any,
  ) {
    if (!['owner'].includes(req.user.role)) {
      throw new Error('Only owner can access payroll reports');
    }
    return this.hr.getPayrollReport(
      req.user.tenant_id,
      Number(year) || new Date().getFullYear(),
      Number(month) || new Date().getMonth() + 1,
    );
  }

  // ── CSV export ───────────────────────────────────────────────
  @Get('hr/payroll-report/export')
  async exportPayroll(
    @Query('year') year: string,
    @Query('month') month: string,
    @Req() req: any,
    @Res() res: Response,
  ) {
    const report = await this.hr.getPayrollReport(
      req.user.tenant_id,
      Number(year) || new Date().getFullYear(),
      Number(month) || new Date().getMonth() + 1,
    );
    const rows = [
      ['Name', 'Role', 'Working Days', 'Present', 'Half Days', 'Leave',
       'Absent', 'LOP', 'Late Count', 'Total Hours', 'CL Balance', 'SL Balance'],
      ...report.staff.map(s => [
        s.full_name, s.role, report.total_working_days,
        s.present_days, s.half_days, s.leave_days,
        s.absent_days, s.lop_days, s.late_count, s.total_hours,
        s.cl_balance ?? 0, s.sl_balance ?? 0,
      ]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition',
      `attachment; filename="payroll-${year}-${month}.csv"`);
    res.send(csv);
  }
}
