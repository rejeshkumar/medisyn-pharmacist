import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between } from 'typeorm';
import * as dayjs from 'dayjs';

const n = (v: any) => Number(v) || 0;

@Injectable()
export class HrService {
  constructor(private dataSource: DataSource) {}

  // ── Shift templates ───────────────────────────────────────────────────────
  async getShifts(tenantId: string) {
    return this.dataSource.query(
      `SELECT * FROM staff_shifts WHERE tenant_id = $1 AND is_active = true
       ORDER BY start_time ASC`,
      [tenantId],
    );
  }

  async upsertShift(tenantId: string, dto: any) {
    const { id, name, start_time, end_time, color } = dto;
    if (id) {
      await this.dataSource.query(
        `UPDATE staff_shifts SET name=$1, start_time=$2, end_time=$3,
         color=$4, updated_at=NOW()
         WHERE id=$5 AND tenant_id=$6`,
        [name, start_time, end_time, color || '#00475a', id, tenantId],
      );
      return { id };
    }
    const r = await this.dataSource.query(
      `INSERT INTO staff_shifts (tenant_id, name, start_time, end_time, color)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenantId, name, start_time, end_time, color || '#00475a'],
    );
    return r[0];
  }

  // ── Roster ────────────────────────────────────────────────────────────────
  async getRoster(tenantId: string, from: string, to: string, userId?: string) {
    const params: any[] = [tenantId, from, to];
    let userFilter = '';
    if (userId) { params.push(userId); userFilter = `AND r.user_id = $${params.length}`; }
    return this.dataSource.query(
      `SELECT r.*, u.full_name, u.role,
              s.name AS shift_name, s.start_time, s.end_time, s.color AS shift_color,
              a.status AS attendance_status, a.check_in_time, a.check_out_time,
              a.is_late, a.working_hours,
              l.leave_type, l.status AS leave_status
       FROM staff_rosters r
       JOIN users u ON u.id = r.user_id
       JOIN staff_shifts s ON s.id = r.shift_id
       LEFT JOIN staff_attendance a
         ON a.user_id = r.user_id AND a.attend_date = r.roster_date AND a.tenant_id = $1
       LEFT JOIN staff_leaves l
         ON l.user_id = r.user_id AND r.roster_date BETWEEN l.from_date AND l.to_date
            AND l.status = 'approved' AND l.tenant_id = $1
       WHERE r.tenant_id = $1
         AND r.roster_date BETWEEN $2 AND $3
         ${userFilter}
       ORDER BY r.roster_date ASC, u.full_name ASC`,
      params,
    );
  }

  async upsertRosterEntry(tenantId: string, dto: any, createdBy: string) {
    const { user_id, shift_id, roster_date, is_week_off, notes } = dto;
    await this.dataSource.query(
      `INSERT INTO staff_rosters
         (tenant_id, user_id, shift_id, roster_date, is_week_off, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (tenant_id, user_id, roster_date)
       DO UPDATE SET shift_id=$3, is_week_off=$5, notes=$6, updated_at=NOW()`,
      [tenantId, user_id, shift_id, roster_date, is_week_off ?? false, notes, createdBy],
    );
    return { ok: true };
  }

  async bulkRoster(tenantId: string, entries: any[], createdBy: string) {
    // Upsert all in one transaction
    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      for (const e of entries) {
        await qr.query(
          `INSERT INTO staff_rosters
             (tenant_id, user_id, shift_id, roster_date, is_week_off, notes, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)
           ON CONFLICT (tenant_id, user_id, roster_date)
           DO UPDATE SET shift_id=$3, is_week_off=$5, updated_at=NOW()`,
          [tenantId, e.user_id, e.shift_id, e.roster_date, e.is_week_off ?? false,
           e.notes ?? null, createdBy],
        );
      }
      await qr.commitTransaction();
      return { saved: entries.length };
    } catch (e) { await qr.rollbackTransaction(); throw e; }
    finally { await qr.release(); }
  }

  // ── Leave ─────────────────────────────────────────────────────────────────
  async getLeaveBalance(tenantId: string, userId: string, year?: number) {
    const y = year ?? new Date().getFullYear();
    return this.dataSource.query(
      `SELECT leave_type, total_days, used_days, pending_days,
              GREATEST(0, total_days - used_days - pending_days) AS available_days
       FROM leave_balances
       WHERE tenant_id=$1 AND user_id=$2 AND year=$3
       ORDER BY leave_type`,
      [tenantId, userId, y],
    );
  }

  async applyLeave(tenantId: string, userId: string, dto: any) {
    const {
      leave_type, from_date, to_date, reason, is_half_day, half_day_part,
    } = dto;

    // Calculate working days (exclude Sundays and public holidays)
    const days = await this._countWorkingDays(tenantId, from_date, to_date, is_half_day);

    if (days <= 0) throw new BadRequestException('No working days in selected range');

    // Check balance for CL/SL/EL/CO
    if (leave_type !== 'LOP' && leave_type !== 'ML') {
      const bal = await this.dataSource.query(
        `SELECT GREATEST(0, total_days - used_days - pending_days) AS available
         FROM leave_balances WHERE tenant_id=$1 AND user_id=$2
         AND year=$3 AND leave_type=$4`,
        [tenantId, userId, new Date(from_date).getFullYear(), leave_type],
      );
      const available = n(bal[0]?.available ?? 0);
      if (available < days) {
        throw new BadRequestException(
          `Insufficient ${leave_type} balance. Available: ${available} days, Requested: ${days} days`,
        );
      }
    }

    // Check for duplicate leave in date range
    const overlap = await this.dataSource.query(
      `SELECT COUNT(*) FROM staff_leaves
       WHERE tenant_id=$1 AND user_id=$2
         AND status NOT IN ('rejected','cancelled')
         AND from_date <= $3 AND to_date >= $4`,
      [tenantId, userId, to_date, from_date],
    );
    if (n(overlap[0]?.count) > 0) {
      throw new BadRequestException('Leave already applied for overlapping dates');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      const leave = await qr.query(
        `INSERT INTO staff_leaves
           (tenant_id, user_id, leave_type, from_date, to_date, days_count,
            is_half_day, half_day_part, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [tenantId, userId, leave_type, from_date, to_date, days,
         is_half_day ?? false, half_day_part ?? null, reason ?? null],
      );

      // Deduct from pending balance
      if (leave_type !== 'LOP' && leave_type !== 'ML') {
        await qr.query(
          `UPDATE leave_balances SET pending_days = pending_days + $1, updated_at=NOW()
           WHERE tenant_id=$2 AND user_id=$3
             AND year=$4 AND leave_type=$5`,
          [days, tenantId, userId, new Date(from_date).getFullYear(), leave_type],
        );
      }
      await qr.commitTransaction();
      return leave[0];
    } catch (e) { await qr.rollbackTransaction(); throw e; }
    finally { await qr.release(); }
  }

  async approveRejectLeave(
    tenantId: string, leaveId: string, action: 'approved' | 'rejected',
    approverId: string, note?: string,
  ) {
    const leave = await this.dataSource.query(
      `SELECT * FROM staff_leaves WHERE id=$1 AND tenant_id=$2`,
      [leaveId, tenantId],
    );
    if (!leave[0]) throw new NotFoundException('Leave request not found');
    if (leave[0].status !== 'pending') {
      throw new BadRequestException('Leave request already processed');
    }

    const qr = this.dataSource.createQueryRunner();
    await qr.connect(); await qr.startTransaction();
    try {
      await qr.query(
        `UPDATE staff_leaves SET status=$1, approved_by=$2,
         approved_at=NOW(), rejection_note=$3, updated_at=NOW()
         WHERE id=$4`,
        [action, approverId, note ?? null, leaveId],
      );

      const days = n(leave[0].days_count);
      const lt   = leave[0].leave_type;
      const yr   = new Date(leave[0].from_date).getFullYear();

      if (action === 'approved') {
        // Move pending → used
        if (lt !== 'LOP' && lt !== 'ML') {
          await qr.query(
            `UPDATE leave_balances
             SET pending_days = GREATEST(0, pending_days - $1),
                 used_days = used_days + $1, updated_at=NOW()
             WHERE tenant_id=$2 AND user_id=$3 AND year=$4 AND leave_type=$5`,
            [days, tenantId, leave[0].user_id, yr, lt],
          );
        }
        // Mark attendance as on_leave for each day
        await this._markLeaveAttendance(qr, tenantId, leave[0].user_id, leaveId,
          leave[0].from_date, leave[0].to_date);
      } else {
        // Rejected — release pending
        if (lt !== 'LOP' && lt !== 'ML') {
          await qr.query(
            `UPDATE leave_balances
             SET pending_days = GREATEST(0, pending_days - $1), updated_at=NOW()
             WHERE tenant_id=$2 AND user_id=$3 AND year=$4 AND leave_type=$5`,
            [days, tenantId, leave[0].user_id, yr, lt],
          );
        }
      }
      await qr.commitTransaction();
      return { ok: true, action };
    } catch (e) { await qr.rollbackTransaction(); throw e; }
    finally { await qr.release(); }
  }

  async getLeaves(tenantId: string, filters: any) {
    const params: any[] = [tenantId];
    const where: string[] = [];
    if (filters.userId)  { params.push(filters.userId);  where.push(`l.user_id = $${params.length}`); }
    if (filters.status)  { params.push(filters.status);  where.push(`l.status = $${params.length}`); }
    if (filters.month) {
      const [y, m] = filters.month.split('-');
      params.push(`${y}-${m}-01`);
      params.push(`${y}-${m}-31`);
      where.push(`l.from_date <= $${params.length - 1 + 1}` );
      where.push(`l.to_date >= $${params.length}`);
    }
    const whereClause = where.length ? 'AND ' + where.join(' AND ') : '';
    return this.dataSource.query(
      `SELECT l.*, u.full_name, u.role,
              ab.full_name AS approved_by_name
       FROM staff_leaves l
       JOIN users u ON u.id = l.user_id
       LEFT JOIN users ab ON ab.id = l.approved_by
       WHERE l.tenant_id = $1 ${whereClause}
       ORDER BY l.created_at DESC
       LIMIT 100`,
      params,
    );
  }

  // ── Attendance ────────────────────────────────────────────────────────────
  async checkIn(tenantId: string, userId: string, notes?: string) {
    const today = dayjs().format('YYYY-MM-DD');
    const now   = new Date();

    // Prevent double check-in
    const existing = await this.dataSource.query(
      `SELECT id, check_in_time FROM staff_attendance
       WHERE tenant_id=$1 AND user_id=$2 AND attend_date=$3`,
      [tenantId, userId, today],
    );
    if (existing[0]?.check_in_time) {
      throw new BadRequestException('Already checked in today');
    }

    // Get today's roster to determine shift
    const roster = await this.dataSource.query(
      `SELECT r.*, s.start_time, s.end_time
       FROM staff_rosters r
       JOIN staff_shifts s ON s.id = r.shift_id
       WHERE r.tenant_id=$1 AND r.user_id=$2 AND r.roster_date=$3`,
      [tenantId, userId, today],
    );

    // Calculate lateness
    let isLate = false;
    let lateMinutes = 0;
    if (roster[0]?.start_time) {
      const [h, m] = roster[0].start_time.split(':').map(Number);
      const shiftStart = dayjs().hour(h).minute(m).second(0);
      const diff = dayjs(now).diff(shiftStart, 'minute');
      if (diff > 15) { isLate = true; lateMinutes = diff; }
    }

    await this.dataSource.query(
      `INSERT INTO staff_attendance
         (tenant_id, user_id, roster_id, attend_date, check_in_time, status, is_late, late_minutes, notes)
       VALUES ($1,$2,$3,$4,$5,'present',$6,$7,$8)
       ON CONFLICT (tenant_id, user_id, attend_date)
       DO UPDATE SET check_in_time=$5, status='present', is_late=$6,
                    late_minutes=$7, updated_at=NOW()`,
      [tenantId, userId, roster[0]?.id ?? null, today, now, isLate, lateMinutes, notes ?? null],
    );

    return {
      checked_in_at: now,
      is_late: isLate,
      late_minutes: lateMinutes,
      message: isLate ? `Checked in — ${lateMinutes} minutes late` : 'Checked in on time',
    };
  }

  async checkOut(tenantId: string, userId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    const now   = new Date();

    const record = await this.dataSource.query(
      `SELECT * FROM staff_attendance
       WHERE tenant_id=$1 AND user_id=$2 AND attend_date=$3`,
      [tenantId, userId, today],
    );
    if (!record[0]) throw new BadRequestException('No check-in found for today');
    if (record[0].check_out_time) throw new BadRequestException('Already checked out today');

    const hoursWorked = dayjs(now).diff(dayjs(record[0].check_in_time), 'minute') / 60;
    const status = hoursWorked < 4 ? 'half_day' : 'present';

    await this.dataSource.query(
      `UPDATE staff_attendance
       SET check_out_time=$1, working_hours=$2, status=$3, updated_at=NOW()
       WHERE tenant_id=$4 AND user_id=$5 AND attend_date=$6`,
      [now, hoursWorked.toFixed(2), status, tenantId, userId, today],
    );

    return {
      checked_out_at: now,
      working_hours: hoursWorked.toFixed(2),
      status,
      message: `Checked out — ${hoursWorked.toFixed(1)} hours worked`,
    };
  }

  async getAttendance(tenantId: string, filters: any) {
    const params: any[] = [tenantId];
    const where: string[] = [];
    if (filters.userId) { params.push(filters.userId); where.push(`a.user_id = $${params.length}`); }
    if (filters.from)   { params.push(filters.from);   where.push(`a.attend_date >= $${params.length}`); }
    if (filters.to)     { params.push(filters.to);     where.push(`a.attend_date <= $${params.length}`); }
    const whereClause = where.length ? 'AND ' + where.join(' AND ') : '';
    return this.dataSource.query(
      `SELECT a.*, u.full_name, u.role,
              s.name AS shift_name, s.start_time, s.end_time
       FROM staff_attendance a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN staff_rosters r ON r.id = a.roster_id
       LEFT JOIN staff_shifts s ON s.id = r.shift_id
       WHERE a.tenant_id = $1 ${whereClause}
       ORDER BY a.attend_date DESC, u.full_name ASC
       LIMIT 500`,
      params,
    );
  }

  // ── Payroll report ────────────────────────────────────────────────────────
  async getPayrollReport(tenantId: string, year: number, month: number) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = dayjs(from).endOf('month').format('YYYY-MM-DD');

    // Count working days in month (excluding Sundays and public holidays)
    const totalWorkingDays = await this._countWorkingDays(tenantId, from, to, false);

    const rows = await this.dataSource.query(
      `SELECT
         u.id AS user_id, u.full_name, u.role,
         COUNT(*) FILTER (WHERE a.status = 'present') AS present_days,
         COUNT(*) FILTER (WHERE a.status = 'half_day') AS half_days,
         COUNT(*) FILTER (WHERE a.status = 'on_leave')  AS leave_days,
         COUNT(*) FILTER (WHERE a.status = 'absent')    AS absent_days,
         COUNT(*) FILTER (WHERE a.is_late = true)       AS late_count,
         COALESCE(SUM(a.working_hours), 0)              AS total_hours,
         -- CL/SL balances
         (SELECT GREATEST(0, total_days - used_days)
          FROM leave_balances lb
          WHERE lb.tenant_id = $1 AND lb.user_id = u.id
            AND lb.year = $2 AND lb.leave_type = 'CL') AS cl_balance,
         (SELECT GREATEST(0, total_days - used_days)
          FROM leave_balances lb
          WHERE lb.tenant_id = $1 AND lb.user_id = u.id
            AND lb.year = $2 AND lb.leave_type = 'SL') AS sl_balance
       FROM users u
       LEFT JOIN staff_attendance a
         ON a.user_id = u.id AND a.tenant_id = $1
         AND a.attend_date BETWEEN $3 AND $4
       WHERE u.tenant_id = $1
         AND u.role != 'owner'
       GROUP BY u.id, u.full_name, u.role
       ORDER BY u.full_name`,
      [tenantId, year, from, to],
    );

    return {
      year, month, from, to,
      total_working_days: totalWorkingDays,
      staff: rows.map(r => ({
        ...r,
        present_days:  n(r.present_days),
        half_days:     n(r.half_days),
        leave_days:    n(r.leave_days),
        absent_days:   n(r.absent_days),
        late_count:    n(r.late_count),
        total_hours:   n(r.total_hours),
        effective_days: n(r.present_days) + (n(r.half_days) * 0.5) + n(r.leave_days),
        lop_days: Math.max(0,
          totalWorkingDays - n(r.present_days) - (n(r.half_days) * 0.5) - n(r.leave_days)
        ),
      })),
    };
  }

  // ── Today's status for current user ──────────────────────────────────────
  async getTodayStatus(tenantId: string, userId: string) {
    const today = dayjs().format('YYYY-MM-DD');
    const [attendance, roster, leaves, balances] = await Promise.all([
      this.dataSource.query(
        `SELECT a.*, s.name AS shift_name, s.start_time, s.end_time
         FROM staff_attendance a
         LEFT JOIN staff_rosters r ON r.id = a.roster_id
         LEFT JOIN staff_shifts s ON s.id = r.shift_id
         WHERE a.tenant_id=$1 AND a.user_id=$2 AND a.attend_date=$3`,
        [tenantId, userId, today],
      ),
      this.dataSource.query(
        `SELECT r.*, s.name, s.start_time, s.end_time, s.color
         FROM staff_rosters r
         JOIN staff_shifts s ON s.id = r.shift_id
         WHERE r.tenant_id=$1 AND r.user_id=$2 AND r.roster_date=$3`,
        [tenantId, userId, today],
      ),
      this.dataSource.query(
        `SELECT leave_type, from_date, to_date, status
         FROM staff_leaves
         WHERE tenant_id=$1 AND user_id=$2
           AND $3 BETWEEN from_date AND to_date
           AND status IN ('pending','approved')`,
        [tenantId, userId, today],
      ),
      this.getLeaveBalance(tenantId, userId),
    ]);
    return {
      today,
      attendance: attendance[0] ?? null,
      roster: roster[0] ?? null,
      active_leaves: leaves,
      leave_balances: balances,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────
  private async _countWorkingDays(
    tenantId: string, from: string, to: string, isHalfDay: boolean,
  ): Promise<number> {
    const holidays = await this.dataSource.query(
      `SELECT holiday_date FROM public_holidays
       WHERE tenant_id=$1 AND holiday_date BETWEEN $2 AND $3`,
      [tenantId, from, to],
    );
    const holidaySet = new Set(holidays.map((h: any) =>
      dayjs(h.holiday_date).format('YYYY-MM-DD')
    ));
    let count = 0;
    let cur = dayjs(from);
    const end = dayjs(to);
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      if (cur.day() !== 0 && !holidaySet.has(cur.format('YYYY-MM-DD'))) {
        count++;
      }
      cur = cur.add(1, 'day');
    }
    return isHalfDay ? 0.5 : count;
  }

  private async _markLeaveAttendance(
    qr: any, tenantId: string, userId: string, leaveId: string,
    from: string, to: string,
  ) {
    let cur = dayjs(from);
    const end = dayjs(to);
    while (cur.isBefore(end) || cur.isSame(end, 'day')) {
      const dateStr = cur.format('YYYY-MM-DD');
      await qr.query(
        `INSERT INTO staff_attendance
           (tenant_id, user_id, attend_date, status, leave_id)
         VALUES ($1,$2,$3,'on_leave',$4)
         ON CONFLICT (tenant_id, user_id, attend_date)
         DO UPDATE SET status='on_leave', leave_id=$4, updated_at=NOW()`,
        [tenantId, userId, dateStr, leaveId],
      );
      cur = cur.add(1, 'day');
    }
  }
}
