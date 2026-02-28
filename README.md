# MediSyn Pharmacist App

AI-powered pharmacy management system for MediSyn Specialty Clinic, Taliparamba.

## Stack

| Layer | Technology |
|---|---|
| Backend API | NestJS + TypeScript |
| Database | PostgreSQL |
| Frontend Web | Next.js 14 + Tailwind CSS |
| AI / OCR | OpenAI GPT-4o (Vision) |
| File Storage | Local (upgradeable to AWS S3) |

---

## Prerequisites

Install these before starting:

1. **Node.js** (v20+): https://nodejs.org/en/download
2. **PostgreSQL** (v14+): https://www.postgresql.org/download/macosx/
   - Or use Docker: `docker run --name medisyn-db -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`
3. **npm** (comes with Node.js)

---

## Setup & Run

### 1. Install dependencies

```bash
cd /Users/rejesh.kumar/Desktop/Project-\ AI/medisyn

# Install backend dependencies
cd apps/api
npm install

# Install frontend dependencies
cd ../web
npm install
```

### 2. Configure the backend

```bash
cd apps/api
cp .env.example .env
```

Edit `.env` with your values:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_DATABASE=medisyn

JWT_SECRET=change-this-to-something-long-and-random
JWT_EXPIRES_IN=8h

PORT=3001
NODE_ENV=development

# OPTIONAL: For AI prescription parsing
OPENAI_API_KEY=sk-your-openai-api-key

# OPTIONAL: For cloud file storage
STORAGE_PROVIDER=local
```

### 3. Configure the frontend

```bash
cd apps/web
cp .env.local.example .env.local
```

`.env.local` contents:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 4. Create the database

```bash
# Connect to PostgreSQL and create the database
psql -U postgres -c "CREATE DATABASE medisyn;"
```

### 5. Run both servers

**Terminal 1 — Backend API:**
```bash
cd apps/api
npm run dev
```

**Terminal 2 — Frontend Web App:**
```bash
cd apps/web
npm run dev
```

### 6. Access the app

| URL | Description |
|---|---|
| http://localhost:3000 | Web App (Login page) |
| http://localhost:3001/api/docs | API Documentation (Swagger) |

---

## Default Login

| Field | Value |
|---|---|
| Mobile | `9999999999` |
| Password | `admin123` |
| Role | Owner (full access) |

The default owner account is auto-created when the API first starts. Change the password after first login.

---

## Features (MVP V1)

| Module | Status |
|---|---|
| JWT Authentication + Role-based access | ✅ |
| Medicine Master (CRUD + search) | ✅ |
| Stock & Batch Management | ✅ |
| AI Prescription Parsing (OCR + GPT-4o) | ✅ |
| Dispensing Cart with Substitutes | ✅ |
| Billing & Invoice Generation | ✅ |
| Schedule Drug Compliance Register | ✅ |
| Reports & Owner Dashboard | ✅ |
| Bulk Upload (Excel/CSV) | ✅ |
| User Management | ✅ |

---

## Project Structure

```
medisyn/
├── apps/
│   ├── api/                    ← NestJS Backend
│   │   └── src/
│   │       ├── auth/           JWT auth + login
│   │       ├── users/          User management
│   │       ├── medicines/      Medicine master + substitutes
│   │       ├── stock/          Inventory + purchase + alerts
│   │       ├── sales/          Billing + dispensing
│   │       ├── ai-prescription/OCR + GPT-4o extraction
│   │       ├── substitutes/    Substitute engine
│   │       ├── compliance/     Schedule drug register
│   │       ├── bulk/           Excel import/export
│   │       └── reports/        Dashboard + reports
│   └── web/                    ← Next.js Frontend
│       └── src/app/
│           ├── (auth)/login    Login page
│           └── (dashboard)/
│               ├── dashboard   KPI dashboard
│               ├── dispensing  Dispense cart + AI Rx
│               ├── medicines   Medicine master
│               ├── stock       Inventory management
│               ├── billing     Bills history
│               ├── compliance  Schedule drug log
│               ├── reports     Analytics + exports
│               ├── bulk        Excel import wizard
│               └── users       User management
└── README.md
```

---

## API Documentation

Once the backend is running, visit:
**http://localhost:3001/api/docs**

All endpoints are documented with Swagger. Use the "Authorize" button and enter your JWT token to test authenticated endpoints.

---

## AI Prescription Parsing

The AI module works in two modes:

1. **With OpenAI API key** (recommended): Set `OPENAI_API_KEY` in `.env`. The system uses GPT-4o Vision to extract medicine names, strength, dosage, frequency, and duration from prescription images.

2. **Without API key** (demo mode): The system returns mock extraction data so you can test the workflow without any external API.

**Supported formats:** JPG, PNG, PDF (up to 15MB)

---

## Role Permissions

| Feature | Owner | Pharmacist | Assistant |
|---|---|---|---|
| Login | ✅ | ✅ | ✅ |
| Dashboard | ✅ | ✅ | ✅ |
| Dispensing + Billing | ✅ | ✅ | ❌ |
| Stock View | ✅ | ✅ | ✅ |
| Purchase Entry | ✅ | ✅ | ❌ |
| Bulk Upload | ✅ | ❌ | ❌ |
| Reports | ✅ | Limited | ❌ |
| User Management | ✅ | ❌ | ❌ |

---

## Production Deployment

For production:

1. Set `NODE_ENV=production` in `.env`
2. Set a strong `JWT_SECRET`
3. Use a managed PostgreSQL (Supabase, AWS RDS, etc.)
4. Deploy API to Railway, Render, or AWS EC2
5. Deploy web to Vercel (set `NEXT_PUBLIC_API_URL` to your API domain)
6. Configure HTTPS on both services

---

## Phase 2 Roadmap

- PMS Integration (clinic software sync)
- React Native mobile + tablet app
- WhatsApp prescription uploads
- SMS alerts for low stock
- GST-compliant invoice export
- Multi-branch support
