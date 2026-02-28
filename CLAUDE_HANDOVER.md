# MediSyn — Claude Developer Handover Document

**Project:** MediSyn Pharmacist App  
**Client:** MediSyn Specialty Clinic, Taliparamba, Kerala  
**Handover Date:** February 2026  
**Status:** Active development — core modules complete, several features pending

---

## 1. Project Overview

MediSyn is an AI-powered pharmacy management system built for a specialty clinic in Taliparamba, Kerala. It is a full-stack web application that handles:

- Drug dispensing with AI-assisted prescription reading
- Inventory and stock batch management
- Patient registration with VIP membership
- Billing with bill preview and print
- Schedule drug compliance logging (H, H1, X class drugs)
- Reports and analytics

---

## 2. Repository Location

```
/Users/rejesh.kumar/Desktop/Project- AI/medisyn/
```

### Monorepo Structure

```
medisyn/
├── apps/
│   ├── api/          ← NestJS backend (port 3001)
│   └── web/          ← Next.js 14 frontend (port 3000)
├── package.json      ← Root workspace
├── DEPLOYMENT_GUIDE.md
├── CLAUDE_HANDOVER.md  ← this file
├── setup-server.sh     ← automated cloud server setup
└── deploy-update.sh    ← Mac → server code push script
```

---

## 3. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Backend API | NestJS + TypeScript | v10 |
| Database | PostgreSQL | v14+ |
| ORM | TypeORM | latest |
| Frontend | Next.js 14 + Tailwind CSS | 14.1.0 |
| State / Data Fetching | TanStack Query (React Query) | v5 |
| Forms | react-hook-form | v7 |
| Auth | JWT (NestJS JWT + Passport) | — |
| AI / OCR | OpenAI GPT-4o Vision | — |
| File Storage | Local (upgradeable to S3) | — |
| UI Icons | Lucide React | — |

---

## 4. How to Run Locally

### Prerequisites
- Node.js v20+
- PostgreSQL v14+ running locally
- `.env` file configured (see Section 5)

### Start Backend (API)
```bash
cd /Users/rejesh.kumar/Desktop/Project-\ AI/medisyn/apps/api
npm install
npm run dev          # runs on http://localhost:3001
```

### Start Frontend (Web)
```bash
cd /Users/rejesh.kumar/Desktop/Project-\ AI/medisyn/apps/web
npm install
npm run dev          # runs on http://localhost:3000
```

### API Docs (Swagger)
```
http://localhost:3001/api/docs
```

---

## 5. Environment Variables

### Backend — `apps/api/.env`
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=medisyn

JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=8h

PORT=3001
NODE_ENV=development

OPENAI_API_KEY=sk-your-openai-api-key

STORAGE_PROVIDER=local
LOCAL_UPLOAD_PATH=./uploads
```

### Frontend — `apps/web/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Important Notes
- `synchronize: true` is enabled when `NODE_ENV !== 'production'` — TypeORM auto-syncs schema in dev
- In production, set `NODE_ENV=production` and run migrations manually
- CORS in `apps/api/src/main.ts` currently allows `localhost:3000` — update this for production domain

---

## 6. Database Schema — All Entities

All entities live in: `apps/api/src/database/entities/`

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | — |
| full_name | varchar | — |
| mobile | varchar UNIQUE | used as login username |
| password_hash | varchar | bcrypt hashed |
| role | enum | `owner`, `pharmacist`, `assistant` |
| status | enum | `active`, `inactive` |

### `medicines`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | — |
| brand_name | varchar | indexed |
| molecule | varchar | indexed (generic/active ingredient) |
| strength | varchar | e.g. "500mg" |
| dosage_form | varchar(50) | **Changed from enum to varchar** — see note below |
| schedule_class | enum | `OTC`, `H`, `H1`, `X` |
| substitute_group_key | varchar | auto-generated `molecule_strength_form` |
| gst_percent | decimal(5,2) | — |
| mrp | decimal(10,2) | — |
| sale_rate | decimal(10,2) | — |
| manufacturer | varchar | — |
| category | varchar | e.g. "Antibiotic" |
| rx_units | varchar(20) | units/tsp/ml/drps/puff/mg/μg/g |
| stock_group | varchar | therapeutic group |
| treatment_for | varchar | condition treated |
| description | text | notes |
| discount_percent | decimal(5,2) | medicine-level default discount |
| rack_location | varchar | shelf position e.g. "A-12" |
| intake_route | varchar(50) | Oral/Topical/Parenteral etc. |
| reorder_qty | int | minimum stock before alert |
| is_rx_required | boolean | prescription mandatory flag |
| is_active | boolean | soft delete |

> **Important DB note:** `dosage_form` was originally a PostgreSQL native enum. It was changed to `varchar` for flexibility. If you get a TypeORM sync error about this column, run the SQL patch:
> `apps/api/src/database/patch-medicine-columns.sql`

**DosageForm values (19 types):** Tablet, Capsule, Injection, Vial, Suspension, Drops, Powder, Syrup, Gel, Liquid, Lotion, Cream, Eye Drops, Ointment, Soap, Inhaler, Pill, Patch, Other

### `stock_batches`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | — |
| medicine_id | FK → medicines | — |
| batch_number | varchar | — |
| expiry_date | date | indexed |
| quantity | int | current stock, decremented on sale |
| purchase_price | decimal | — |
| mrp | decimal | — |
| sale_rate | decimal | — |
| supplier_id | FK → suppliers | nullable |
| purchase_invoice_no | varchar | — |
| is_active | boolean | — |

### `suppliers`
| Column | Type |
|---|---|
| id | uuid PK |
| name, contact_person, phone, email, address, gstin | varchar |
| is_active | boolean |

### `sales`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | — |
| bill_number | varchar UNIQUE | format: `BILL-YYYYMMDD-XXXX` |
| customer_name | varchar | patient name |
| doctor_name, doctor_reg_no | varchar | — |
| subtotal, discount_amount, tax_amount, total_amount | decimal | — |
| discount_percent | decimal | — |
| payment_mode | enum | `cash`, `card`, `upi` |
| prescription_image_url | varchar | uploaded Rx image |
| ai_prescription_id | varchar | FK to AI parse record |
| has_scheduled_drugs | boolean | H/H1/X flag |
| is_voided | boolean | soft delete/void |
| voided_by, voided_reason | varchar | — |
| created_by | FK → users | pharmacist |

### `sale_items`
| Column | Type |
|---|---|
| id | uuid PK |
| sale_id | FK → sales |
| medicine_id | FK → medicines |
| batch_id | FK → stock_batches |
| qty | int |
| rate, gst_percent, item_total | decimal |
| is_substituted | boolean |
| original_medicine_id, substitution_reason | varchar |
| medicine_name, batch_number | varchar (denormalized) |

### `schedule_drug_logs`
Compliance log for Schedule H/H1/X drug dispensing per Drugs & Cosmetics Act.

### `ai_prescriptions`
Stores OpenAI GPT-4o Vision parse results for uploaded prescription images.

### `stock_adjustments`
Manual stock adjustment records (damage, expiry removal, correction).

### `bulk_activity_logs`
Bulk CSV import history.

### `patients` *(added in this session)*
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | — |
| uhid | varchar UNIQUE | auto: `MED-YYYYMMDD-XXXX` |
| salutation | enum | Mr/Mrs/Ms/Dr/Baby/Other |
| first_name, last_name | varchar | — |
| gender | enum | male/female/other |
| dob | date | — |
| age | int | — |
| mobile | varchar | indexed |
| email, area, address | varchar/text | — |
| category | enum | general/insurance/corporate/senior |
| ref_by | varchar | referring doctor |
| residence_number | varchar | — |
| is_first_visit | boolean | — |
| notes | text | — |
| is_vip | boolean | VIP pass enrolled |
| vip_start_date | date | VIP start |
| vip_end_date | date | VIP end (1 year from start) |
| vip_registered_by | varchar | sales staff name |
| is_active | boolean | — |
| created_by | FK → users | — |

### `patient_appointments` *(added in this session)*
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | FK → patients |
| appointment_date | date |
| appointment_time | varchar |
| type | enum: consultation/follow_up/pharmacy_visit/vaccination/review |
| status | enum: scheduled/completed/missed/cancelled |
| doctor_name, notes, cancellation_reason | varchar |
| reminder_sent | boolean |
| created_by | FK → users |

### `patient_reminders` *(added in this session)*
| Column | Type |
|---|---|
| id | uuid PK |
| patient_id | FK → patients |
| appointment_id | varchar (nullable) |
| title | varchar |
| message | text |
| remind_at | timestamp |
| type | enum: appointment/medication/follow_up/vip_renewal/general |
| is_done | boolean |
| created_by | FK → users |

---

## 7. API Modules & Endpoints

All protected routes require `Authorization: Bearer <jwt_token>` header.
Guard is at: `apps/api/src/common/guards/jwt-auth.guard.ts`

### Auth — `/auth`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | Public | Returns JWT token |
| GET | `/auth/me` | JWT | Current user |

### Users — `/users`
| Method | Route | Role |
|---|---|---|
| GET | `/users` | owner |
| POST | `/users` | owner |
| PATCH | `/users/:id` | owner |

### Medicines — `/medicines`
| Method | Route | Notes |
|---|---|---|
| GET | `/medicines` | `?search=` `?category=` `?schedule_class=` |
| POST | `/medicines` | create |
| PATCH | `/medicines/:id` | update |
| PATCH | `/medicines/:id/deactivate` | soft delete |

### Stock — `/stock`
| Method | Route | Notes |
|---|---|---|
| GET | `/stock` | list with expiry status |
| GET | `/stock/:medicineId/best-batch` | best available batch for dispensing |
| POST | `/stock/purchase` | add new stock batch |
| POST | `/stock/adjust` | manual adjustment |
| GET | `/stock/expiring` | expiring soon |
| GET | `/stock/suppliers` | supplier list |
| POST | `/stock/suppliers` | add supplier |

### Sales — `/sales`
| Method | Route | Notes |
|---|---|---|
| GET | `/sales` | `?from=` `?to=` `?search=` |
| POST | `/sales` | create bill, deducts stock |
| GET | `/sales/:id` | bill detail with items |
| POST | `/sales/:id/void` | void a bill, restores stock |

### Patients — `/patients`
| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/patients/vip-register` | **Public** | Sales team VIP self-registration |
| GET | `/patients/stats` | JWT | Dashboard stats |
| GET | `/patients/appointments/today` | JWT | Today's schedule |
| GET | `/patients/appointments/missed` | JWT | Missed visits |
| GET | `/patients/appointments/upcoming` | JWT | Future appointments |
| GET | `/patients/reminders/due` | JWT | Overdue reminders |
| GET | `/patients` | JWT | `?search=` `?is_vip=` `?category=` |
| POST | `/patients` | JWT | Register patient |
| GET | `/patients/:id` | JWT | Patient detail with appointments + reminders |
| PATCH | `/patients/:id` | JWT | Update patient |
| GET | `/patients/:id/appointments` | JWT | Patient appointments |
| POST | `/patients/:id/appointments` | JWT | Book appointment |
| PATCH | `/patients/appointments/:apptId` | JWT | Update status |
| GET | `/patients/:id/reminders` | JWT | Patient reminders |
| POST | `/patients/:id/reminders` | JWT | Add reminder |
| PATCH | `/patients/reminders/:reminderId/done` | JWT | Mark done |

### AI Prescription — `/ai`
| Method | Route | Notes |
|---|---|---|
| POST | `/ai/prescription/parse` | multipart upload, starts GPT-4o parse |
| GET | `/ai/prescription/:id` | poll for result |

### Compliance — `/compliance`
Schedule drug log entries for H/H1/X drugs.

### Reports — `/reports`
Sales reports, expiry reports, stock reports.

### Substitutes — `/substitutes`
| Method | Route | Notes |
|---|---|---|
| GET | `/substitutes` | `?medicine_id=` — same molecule+strength+form medicines |

### Bulk — `/bulk`
CSV bulk import for medicines and stock.

---

## 8. Frontend Pages

All dashboard pages are inside `apps/web/src/app/(dashboard)/` which is auth-protected via `layout.tsx`.

| Route | File | Description |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | Login form |
| `/dashboard` | `(dashboard)/dashboard/page.tsx` | Stats overview |
| `/patients` | `(dashboard)/patients/page.tsx` | Patient list, stats cards, VIP filter |
| `/patients/[id]` | `(dashboard)/patients/[id]/page.tsx` | Patient detail: overview, appointments, reminders |
| `/dispensing` | `(dashboard)/dispensing/page.tsx` | POS-style dispensing with cart |
| `/medicines` | `(dashboard)/medicines/page.tsx` | Drug master CRUD |
| `/stock` | `(dashboard)/stock/page.tsx` | Stock batches, purchase entry |
| `/billing` | `(dashboard)/billing/page.tsx` | Bills history + print |
| `/compliance` | `(dashboard)/compliance/page.tsx` | Schedule drug logs |
| `/reports` | `(dashboard)/reports/page.tsx` | Sales + stock reports |
| `/bulk` | `(dashboard)/bulk/page.tsx` | CSV bulk import |
| `/users` | `(dashboard)/users/page.tsx` | User management (owner only) |
| `/vip-register` | `app/vip-register/page.tsx` | **Public** — VIP self-registration for sales team |

### Key Components
| File | Description |
|---|---|
| `components/billing/BillDocument.tsx` | Reusable bill layout — used for both preview (before dispense) and print (after dispense and from billing history) |

### Navigation Sidebar Roles
| Nav Item | Roles |
|---|---|
| Dashboard | owner, pharmacist, assistant |
| Patients | owner, pharmacist, assistant |
| Dispense | owner, pharmacist |
| Medicines | owner, pharmacist, assistant |
| Stock | owner, pharmacist, assistant |
| Bills | owner, pharmacist |
| Schedule Log | owner, pharmacist |
| Reports | owner, pharmacist |
| Bulk Upload | owner |
| Users | owner |

---

## 9. Key Business Logic

### Bill Generation Flow
1. Pharmacist adds medicines to cart on `/dispensing`
2. Clicks "Generate Bill" → **bill preview modal** appears (no API call yet)
3. Preview shows full formatted bill: clinic header, items table, totals, GST
4. "Confirm & Dispense" → POST `/sales` → stock deducted → print modal auto-opens
5. Print modal has "Print / Save as PDF" button using `window.open()` + `window.print()`

### Stock Deduction Logic
- Each sale item references a specific `stock_batch`
- `batch.quantity` is decremented atomically inside a TypeORM transaction
- If stock insufficient → transaction rolls back, error returned
- Voiding a bill restores stock

### Substitute Suggestions
- Auto-triggered when medicine has no stock
- `substitute_group_key` = `molecule_strength_dosageform` (lowercase)
- Substitutes = other medicines with same `substitute_group_key`

### AI Prescription Parsing
- Upload image → POST `/ai/prescription/parse` → starts async OpenAI job
- Frontend polls GET `/ai/prescription/:id` every 2s until `status === 'completed'`
- Returns matched medicines which pharmacist reviews before adding to cart

### Schedule Drug Compliance
- Cart check: if any item is Schedule H, H1, or X → compliance form required
- On sale creation: `ScheduleDrugLog` record auto-created per scheduled item
- Compliance log stores: patient name, doctor, doctor reg no, prescription image URL

### VIP Pass Logic
- VIP start date = registration date (or custom date entered)
- VIP end date = start date + exactly 1 year (auto-calculated in frontend + validated in backend)
- `vip_register` endpoint is public (no JWT) — used by sales team via shared link
- VIP expiry is shown visually; "Renew VIP" creates a fresh 1-year pass from today

### Auto-Mark Missed Appointments
- `PatientsService.autoMarkMissed(patientId)` is called every time appointments are fetched
- Any appointment with `status=scheduled` and `appointment_date < today` is auto-flipped to `missed`

### Bill Number Format
`BILL-YYYYMMDD-XXXX` — e.g. `BILL-20260225-0023`

### Patient UHID Format
`MED-YYYYMMDD-XXXX` — e.g. `MED-20260225-0005`

---

## 10. Auth System

- Login: `POST /auth/login` with `{ mobile, password }`
- Returns: `{ token, user }` — token stored in `localStorage`
- Frontend auth helper: `apps/web/src/lib/auth.ts`
- API helper (axios instance with auto-auth headers): `apps/web/src/lib/api.ts`
- JWT payload contains: `{ sub: userId, mobile, role }`
- Guard: `apps/api/src/common/guards/jwt-auth.guard.ts`
- Roles guard: `apps/api/src/common/guards/roles.guard.ts`

---

## 11. What Was Built in This Session

The following was designed and implemented during this development session (not in the original scaffold):

| # | Feature | Files Modified/Created |
|---|---|---|
| 1 | **Bill Preview before dispensing** | `dispensing/page.tsx`, `BillDocument.tsx` |
| 2 | **Printable bill** (A4 format, opens print dialog) | `BillDocument.tsx` |
| 3 | **Reprint from billing history** | `billing/page.tsx` |
| 4 | **Drug master expansion** — 19 dosage forms, Rx Units, Intake Route, Rack, Reorder Qty, Treatment For, Stock Group, Discount %, Description, Rx Required flag | `medicine.entity.ts`, `create-medicine.dto.ts`, `medicines/page.tsx` |
| 5 | **Patient Registration module** — full CRUD with all fields from old pharmacy app | `patients/page.tsx`, `patient.entity.ts`, `patients.*` |
| 6 | **Patient Detail** — tabs for overview, appointments, reminders | `patients/[id]/page.tsx` |
| 7 | **Appointment booking** — book, complete, miss, cancel; auto-reminder on booking | `patients.service.ts`, `patient-appointment.entity.ts` |
| 8 | **Reminder system** — set reminders by date, type, mark done, overdue flag | `patient-reminder.entity.ts` |
| 9 | **MediSyn VIP Pass** — enroll, 1-year auto-date, renew, expiry detection | All patient files |
| 10 | **Public VIP registration page** — shareable link for sales team | `app/vip-register/page.tsx` |
| 11 | **Deployment Guide** — step-by-step for non-technical user | `DEPLOYMENT_GUIDE.md` |
| 12 | **Server setup scripts** — automated Hetzner setup | `setup-server.sh`, `deploy-update.sh` |

---

## 12. Known Issues / Pending Items

### Must Fix Before Production
- [ ] `apps/api/src/main.ts` CORS `origin` list — must add production domain
- [ ] Run `patch-medicine-columns.sql` if DB was created before medicine entity changes
- [ ] JWT secret must be changed from default in production `.env`

### Features Discussed but Not Yet Built
- [ ] **Dashboard** — currently shows basic stats; needs charts (daily sales trend, stock alerts, expiring medicines widget, VIP membership count)
- [ ] **Patient ↔ Sales link** — when dispensing, ability to select a registered patient (link `sale.customer_name` to `patient.id`)
- [ ] **Reminder notifications** — currently reminders are stored in DB; no push/SMS/email notification system yet
- [ ] **VIP pass benefits** — auto-apply discount at dispensing based on VIP status
- [ ] **Appointment calendar view** — visual calendar instead of list
- [ ] **Patient visit history** — show past bills for a patient on their detail page
- [ ] **Reports** — patient-wise reports, VIP member reports, missed visit reports
- [ ] **Profile photo upload** for patients (field exists in entity, UI not wired)
- [ ] **Bulk patient import** via CSV
- [ ] **SMS/WhatsApp integration** for appointment reminders (patient mobile stored)
- [ ] **Medicine edit** now has pencil icon — but edit form needs to be verified for all new fields loading correctly

### Minor Technical Debt
- [ ] `patients.service.ts` imports `PartialType` from `@nestjs/swagger` but doesn't use it — can be removed
- [ ] `PatientService.update` dto type is `Partial<CreatePatientDto>` — could be a dedicated `UpdatePatientDto`
- [ ] Dispensing page: after bill is created, cart is cleared. Consider asking "Register this as a patient?" if customer name was entered but no patient selected

---

## 13. Coding Conventions Used

- **TypeScript strict** throughout — no `any` in entities/DTOs (frontend uses `any` in some places for simplicity)
- **NestJS patterns**: module/controller/service per feature, DTOs with class-validator decorators
- **TypeORM**: entities with decorators, repositories injected via `@InjectRepository`, transactions via `QueryRunner`
- **Frontend**: `'use client'` on all interactive pages, TanStack Query for all API calls, `toast` for user feedback
- **Tailwind CSS**: utility-first, custom classes defined in `globals.css` (`.btn-primary`, `.input`, `.card`, `.badge`, `.table-row`, `.label`)
- **Icons**: Lucide React exclusively
- **Guard pattern**: `JwtAuthGuard` is at `common/guards/jwt-auth.guard.ts` — NOT in `auth/guards/` (common mistake — this was a bug fixed in this session)
- **Bill numbers and UHIDs**: zero-padded 4-digit counter + date prefix

---

## 14. File Quick Reference

```
apps/api/src/
├── app.module.ts                    ← register all modules here
├── main.ts                          ← CORS config, port, Swagger
├── common/guards/
│   ├── jwt-auth.guard.ts            ← USE THIS for auth (not auth/guards/)
│   └── roles.guard.ts
├── database/entities/               ← all TypeORM entities
│   ├── medicine.entity.ts           ← DosageForm, RxUnit, IntakeRoute enums
│   ├── patient.entity.ts            ← Salutation, Gender, PatientCategory enums
│   ├── patient-appointment.entity.ts ← AppointmentType, AppointmentStatus enums
│   ├── patient-reminder.entity.ts   ← ReminderType enum
│   └── patch-medicine-columns.sql   ← run once if medicine sync fails
└── patients/
    ├── dto/create-patient.dto.ts    ← includes VipRegisterDto
    ├── dto/create-appointment.dto.ts
    ├── dto/create-reminder.dto.ts
    ├── patients.controller.ts
    ├── patients.service.ts
    └── patients.module.ts

apps/web/src/
├── app/
│   ├── (auth)/login/                ← public, no layout
│   ├── (dashboard)/layout.tsx       ← sidebar nav, auth check
│   ├── (dashboard)/patients/        ← patient list + [id] detail
│   └── vip-register/                ← PUBLIC page, no dashboard layout
├── components/billing/
│   └── BillDocument.tsx             ← mode="preview" or mode="print"
└── lib/
    ├── api.ts                       ← axios instance with JWT header
    ├── auth.ts                      ← getUser(), clearAuth()
    └── utils.ts                     ← formatCurrency, formatDate, cn(), etc.
```

---

## 15. How to Continue Development

When picking up this project, follow these steps:

1. **Read this document fully** before making any changes
2. **Start both servers** (API on 3001, Web on 3000) to verify current state compiles cleanly
3. **Check the Pending Items list** (Section 12) to prioritize next work
4. **Always use `common/guards/jwt-auth.guard.ts`** — never `auth/guards/`
5. **For new API modules**: copy the structure of `patients/` — it's the most recently created and follows all current patterns
6. **For new frontend pages**: copy the structure of `patients/page.tsx` — clean hook patterns, toast feedback, TanStack Query
7. **For DB changes in dev**: TypeORM `synchronize: true` handles new columns automatically; only tricky with enum → varchar changes (use the SQL patch approach)

---

*This document was prepared to ensure zero-loss handover of MediSyn development.*  
*All code is at the path listed in Section 2.*
