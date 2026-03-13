# Office Module — Attendance, Salary & Reports

## Overview

An Office/Admin module for Owner and Admin to manage:
1. **Attendance** — Mark and track staff attendance (check-in/out, leave, half-day)
2. **Salary** — Configure employee pay and calculate monthly salary
3. **Daily Collection** — Report on daily revenue (pharmacy + clinic if applicable)
4. **Reports** — Consolidated admin reports (collection, attendance, salary summary)

---

## Current State

| Area | Exists | Notes |
|------|--------|-------|
| Users | Yes | `users` table — roles: owner, pharmacist, assistant, doctor, receptionist, nurse. No salary/attendance fields |
| Sales | Yes | `sales` table — pharmacy bills, `payment_mode` (cash/card/upi), `total_amount`, `created_by` |
| Reports | Yes | `ReportsService` — daily sales, period sales, top medicines, low stock, near expiry, stock valuation, Excel export |
| Attendance | No | — |
| Salary | No | — |
| Consultation fees | No | Clinic consultation charges not tracked separately (only pharmacy via sales) |

---

## Recommended Architecture

### 1. New Entities (Backend)

**`attendance` table**
```
id, tenant_id, user_id, date (date), check_in (timestamptz), check_out (timestamptz),
status (enum: present, absent, leave, half_day, holiday, weekend),
notes (text), created_by, created_at, updated_at
```

**`employee_salary_config` table** (or extend `users`)
```
id, tenant_id, user_id, salary_type (enum: fixed_monthly, per_day),
base_amount (decimal), effective_from (date), effective_to (date),
payment_day (int, 1-28), notes, created_at, updated_at
```

**`salary_run` table** (optional — for payroll history)
```
id, tenant_id, user_id, month (YYYY-MM), days_present, days_absent, gross_amount,
deductions, net_amount, status (draft, approved, paid), paid_at, created_at
```

### 2. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/office/attendance` | List attendance (filter: date, user_id, from, to) |
| `POST` | `/office/attendance` | Mark attendance (bulk or single) |
| `PATCH` | `/office/attendance/:id` | Update attendance |
| `GET` | `/office/attendance/summary` | Summary by user/period |
| `GET` | `/office/salary-config` | List salary configs |
| `POST` | `/office/salary-config` | Create/update salary config |
| `POST` | `/office/salary/calculate` | Calculate salary for month + user(s) |
| `GET` | `/office/collection/daily` | Daily collection (date, breakdown by payment_mode) |
| `GET` | `/office/collection/period` | Period collection summary |
| `GET` | `/office/reports/dashboard` | Office dashboard stats |

### 3. Frontend Structure

**Option A (recommended):** New route group `/office` with dedicated layout

```
/office                    → Office Dashboard (overview)
/office/attendance         → Attendance marking + calendar view
/office/salary             → Salary config + monthly calculation
/office/collection         → Daily & period collection reports
/office/reports            → Consolidated reports (export)
```

**Option B:** Extend existing dashboard with Office sub-nav (owner-only)

Add "Office" nav item to `(dashboard)/layout.tsx` with sub-routes.

### 4. Access Control

- **Owner** — Full access to all Office features
- **Admin** (if you add this role) — Full access or configurable
- **Others** — No access (or read-only for own attendance)

---

## Implementation Phases

### Phase 1: Foundation (1–2 days)
- Create `attendance` entity + migration
- Create `employee_salary_config` entity + migration
- `OfficeModule` with `AttendanceService`, `SalaryService`
- Basic CRUD for attendance and salary config

### Phase 2: Attendance UI (1 day)
- `/office/attendance` page — date picker, user list, mark present/absent/leave
- Optional: check-in/check-out time capture (manual or future integration with biometric)

### Phase 3: Salary Calculation (1 day)
- Salary calculation logic (fixed monthly vs per-day × days present)
- `/office/salary` page — config list, "Calculate for Month" action, preview

### Phase 4: Collection & Reports (1 day)
- Extend `ReportsService` or new `OfficeReportsService` for:
  - Daily collection (aggregate sales by date, group by payment_mode)
  - Period collection summary
- `/office/collection` page — date range, charts, export

### Phase 5: Office Dashboard (0.5 day)
- `/office` landing — today's collection, pending attendance, salary due this month

---

## Design Decisions to Clarify

1. **Attendance model**
   - **Simple:** Manual mark (present/absent/leave) per day — no check-in/out times
   - **Full:** Check-in, check-out times; late/early tracking
   - **Recommendation:** Start with simple; add check-in/out later if needed

2. **Salary model**
   - **Fixed monthly:** Same amount regardless of days (with leave deduction)
   - **Per-day:** base × days present
   - **Recommendation:** Support both via `salary_type`

3. **Daily collection scope**
   - **Pharmacy only:** Use existing `sales` table (already available)
   - **Clinic + Pharmacy:** Need to add consultation/visit fee tracking (new entity or extend queue)
   - **Recommendation:** Start with pharmacy (sales); add clinic fees in a later phase if required

4. **Deductions**
   - Leave without pay, advance, etc. — add `salary_run` and deduction fields in Phase 3

---

## File Changes Summary

| File | Action |
|------|--------|
| `database/entities/attendance.entity.ts` | Create |
| `database/entities/employee-salary-config.entity.ts` | Create |
| `database/entities/salary-run.entity.ts` | Create (optional, Phase 3) |
| `office/office.module.ts` | Create |
| `office/attendance.service.ts` | Create |
| `office/attendance.controller.ts` | Create |
| `office/salary.service.ts` | Create |
| `office/salary.controller.ts` | Create |
| `office/office-reports.service.ts` | Create (or extend reports) |
| `office/office.controller.ts` | Create |
| `app/web/src/app/office/layout.tsx` | Create |
| `app/web/src/app/office/page.tsx` | Create (dashboard) |
| `app/web/src/app/office/attendance/page.tsx` | Create |
| `app/web/src/app/office/salary/page.tsx` | Create |
| `app/web/src/app/office/collection/page.tsx` | Create |
| `app.module.ts` | Import OfficeModule |
| Navigation | Add Office link (owner-only) |

---

## Quick Start (Minimal MVP)

If you want a minimal first version:

1. **Attendance only** — `attendance` entity + simple mark page (present/absent/leave per user per day)
2. **Daily collection** — New page that calls existing `GET /reports/daily-sales?date=...` and displays it in an Office-style layout with payment mode breakdown
3. **Salary** — Add `base_salary` (nullable) to `users` table; simple monthly calc = base_salary × (days_present / working_days_in_month)

This gets you 80% value with minimal schema change. You can evolve to `employee_salary_config` and `salary_run` later.
