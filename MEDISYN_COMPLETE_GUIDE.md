# MediSyn Pharmacy Management System
## Complete Technical & Operations Guide

**Prepared for:** MediSyn Specialty Clinic, Taliparamba, Kerala  
**Document Version:** 1.0  
**Date:** February 2026  
**Status:** Confidential — Internal Use Only

---

# TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Tech Stack](#2-tech-stack)
3. [System Requirements](#3-system-requirements)
4. [Project Structure](#4-project-structure)
5. [Environment Configuration](#5-environment-configuration)
6. [How to Start the Application](#6-how-to-start-the-application)
7. [Application Features](#7-application-features)
8. [API Reference](#8-api-reference)
9. [Database Schema](#9-database-schema)
10. [Deployment — Cloud Server](#10-deployment--cloud-server)
11. [Moving the App to Another System](#11-moving-the-app-to-another-system)
12. [Access Outside the Clinic Network](#12-access-outside-the-clinic-network)
13. [Backup & Recovery](#13-backup--recovery)
14. [Troubleshooting](#14-troubleshooting)
15. [Cost Summary](#15-cost-summary)
16. [Quick Reference Card](#16-quick-reference-card)

---

# 1. System Overview

MediSyn is an AI-powered pharmacy management system built specifically for MediSyn Specialty Clinic, Taliparamba. It is a full-stack web application that runs in any browser — no installation needed for end users.

## What MediSyn Does

| Module | Description |
|---|---|
| **Patient Management** | Register patients, VIP membership, appointments, reminders |
| **Drug Dispensing** | POS-style billing with AI prescription reading |
| **Medicine Master** | Complete drug database with 19 dosage forms |
| **Stock Management** | Batch-wise inventory, expiry tracking, purchase entry |
| **Billing** | Bill preview, print, history, void |
| **AI Prescription** | Upload prescription image → auto-reads medicines via GPT-4o |
| **Schedule Drug Log** | Compliance records for H/H1/X class drugs |
| **Reports** | Sales, stock, expiry reports |
| **VIP Pass** | 1-year membership with public registration link for sales team |

## How It Works

```
Pharmacist's Browser
        │
        ▼
   Next.js Web App
   (port 3000)
        │  API Calls
        ▼
   NestJS API Server
   (port 3001)
        │
        ├──► PostgreSQL Database
        ├──► OpenAI GPT-4o (AI prescription reading)
        └──► Local Storage (prescription images)
```

---

# 2. Tech Stack

## Backend

| Technology | Version | Purpose |
|---|---|---|
| NestJS | v10 | REST API framework |
| TypeScript | v5 | Programming language |
| PostgreSQL | v14+ | Main database |
| TypeORM | latest | Database ORM |
| JWT + Passport.js | — | Authentication |
| class-validator | — | Input validation |
| Swagger / OpenAPI | — | API documentation |
| OpenAI GPT-4o | — | AI prescription parsing |
| Day.js | — | Date handling |

## Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 14.1.0 | React web framework |
| TypeScript | v5 | Programming language |
| Tailwind CSS | v3 | Styling |
| TanStack Query | v5 | Data fetching & caching |
| Axios | v1.6 | HTTP client |
| React Hook Form | v7 | Form management |
| Zustand | v4 | State management |
| Lucide React | — | Icons |
| React Hot Toast | — | Notifications |

## Infrastructure

| Technology | Purpose |
|---|---|
| npm Workspaces | Monorepo management |
| Hetzner Cloud | Production hosting |
| Nginx | Reverse proxy |
| PM2 | Process manager |
| Let's Encrypt / Certbot | Free SSL/HTTPS |
| Cloudflare Tunnel | Optional: local-to-internet tunnel |

---

# 3. System Requirements

## Development Machine (Your Mac)

| Requirement | Minimum | Recommended |
|---|---|---|
| Operating System | macOS 12+ | macOS 14+ |
| RAM | 8 GB | 16 GB |
| Storage | 5 GB free | 20 GB free |
| Internet | Any broadband | Any broadband |
| Node.js | v20+ | v20 LTS |
| PostgreSQL | v14+ | v16 |

## Cloud Server (for production hosting)

| Specification | Value |
|---|---|
| Provider | Hetzner Cloud |
| Plan | CX22 |
| CPU | 2 vCores |
| RAM | 4 GB |
| SSD | 40 GB |
| OS | Ubuntu 22.04 LTS |
| Monthly Cost | ~€4.49 (~₹400) |

## Client Devices (staff / pharmacists)

Any device with a modern browser:
- Chrome, Firefox, Safari, Edge (any recent version)
- Works on mobile phones, tablets, laptops
- No software installation required

---

# 4. Project Structure

## Location on Your Mac

```
/Users/rejesh.kumar/Desktop/Project- AI/medisyn/
```

## Folder Layout

```
medisyn/
├── apps/
│   ├── api/                    ← Backend (NestJS)
│   │   ├── src/
│   │   │   ├── app.module.ts   ← Main module (registers all features)
│   │   │   ├── main.ts         ← Server entry point (port, CORS, Swagger)
│   │   │   ├── auth/           ← Login, JWT
│   │   │   ├── patients/       ← Patient management
│   │   │   ├── medicines/      ← Drug master
│   │   │   ├── stock/          ← Inventory
│   │   │   ├── sales/          ← Billing
│   │   │   ├── reports/        ← Reports
│   │   │   ├── compliance/     ← Schedule drug logs
│   │   │   ├── ai-prescription/← OpenAI integration
│   │   │   ├── users/          ← Staff management
│   │   │   ├── bulk/           ← CSV import
│   │   │   ├── substitutes/    ← Drug substitutes
│   │   │   └── database/
│   │   │       └── entities/   ← All database table definitions
│   │   ├── .env                ← SECRET — do not share/commit
│   │   └── package.json
│   │
│   └── web/                    ← Frontend (Next.js)
│       ├── src/
│       │   ├── app/
│       │   │   ├── (dashboard)/← All protected pages
│       │   │   │   ├── patients/
│       │   │   │   ├── dispensing/
│       │   │   │   ├── medicines/
│       │   │   │   ├── stock/
│       │   │   │   ├── billing/
│       │   │   │   ├── reports/
│       │   │   │   └── users/
│       │   │   └── vip-register/ ← Public VIP page
│       │   ├── components/
│       │   │   └── billing/
│       │   │       └── BillDocument.tsx ← Bill preview + print
│       │   └── lib/
│       │       ├── api.ts       ← Axios with auto-auth
│       │       ├── auth.ts      ← Login helpers
│       │       └── utils.ts     ← formatCurrency, formatDate etc.
│       ├── .env.local           ← API URL config
│       └── package.json
│
├── DEPLOYMENT_GUIDE.md         ← Step-by-step server deployment
├── CLAUDE_HANDOVER.md          ← Developer handover document
├── MEDISYN_COMPLETE_GUIDE.md   ← This document
├── setup-server.sh             ← Automated server setup script
└── deploy-update.sh            ← Code push script (Mac → Server)
```

---

# 5. Environment Configuration

## Backend — `apps/api/.env`

Create this file if it does not exist:

```
# ── Database ──────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_postgres_password
DB_DATABASE=medisyn

# ── Authentication ────────────────────────────────────────
JWT_SECRET=choose_a_long_random_string_minimum_32_characters
JWT_EXPIRES_IN=8h

# ── Application ───────────────────────────────────────────
PORT=3001
NODE_ENV=development

# ── OpenAI (for AI prescription feature) ─────────────────
OPENAI_API_KEY=sk-your-openai-api-key-here

# ── File Storage ──────────────────────────────────────────
STORAGE_PROVIDER=local
LOCAL_UPLOAD_PATH=./uploads
```

## Frontend — `apps/web/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> **Security Note:** Never share the `.env` file. Never upload it to GitHub. It contains your database password and OpenAI API key.

---

# 6. How to Start the Application

## Prerequisites (First Time Only)

### 1. Install Homebrew (Mac package manager)
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Install Node.js
```bash
brew install node@20
```

### 3. Install PostgreSQL
```bash
brew install postgresql@14
brew services start postgresql@14
```

### 4. Create the Database
```bash
psql -U postgres -c "CREATE DATABASE medisyn;"
```

---

## Starting the App (Every Time)

You need **two Terminal windows** running simultaneously.

### Terminal Window 1 — Start Backend API

```bash
cd "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/apps/api"
npm install
npm run dev
```

**Wait for this message:**
```
🏥 MediSyn API running on http://localhost:3001
📖 API Docs at http://localhost:3001/api/docs
```

### Terminal Window 2 — Start Frontend

```bash
cd "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/apps/web"
npm install
npm run dev
```

**Wait for this message:**
```
▲ Next.js 14.x.x
- Local:   http://localhost:3000
```

### Open in Browser

| URL | Purpose |
|---|---|
| **http://localhost:3000** | Main application |
| http://localhost:3001/api/docs | API documentation |
| http://localhost:3000/vip-register | Public VIP registration |

---

## Stopping the Application

Press `Ctrl + C` in each Terminal window.

---

# 7. Application Features

## Navigation Sidebar

| Menu Item | Who Can Access |
|---|---|
| Dashboard | Owner, Pharmacist, Assistant |
| Patients | Owner, Pharmacist, Assistant |
| Dispense | Owner, Pharmacist |
| Medicines | Owner, Pharmacist, Assistant |
| Stock | Owner, Pharmacist, Assistant |
| Bills | Owner, Pharmacist |
| Schedule Log | Owner, Pharmacist |
| Reports | Owner, Pharmacist |
| Bulk Upload | Owner only |
| Users | Owner only |

## User Roles

| Role | Access Level |
|---|---|
| **Owner** | Full access to everything |
| **Pharmacist** | All clinical operations |
| **Assistant** | View-only for medicines and stock |

---

## Feature Details

### Patient Management (`/patients`)
- Register patients with full details (name, DOB, gender, mobile, address, UHID)
- Auto-generated UHID format: `MED-YYYYMMDD-XXXX`
- VIP Pass enrollment with 1-year auto-expiry date
- Stats: Total patients, VIP members, Today's appointments, Missed visits

### Patient Detail (`/patients/[id]`)
**Overview Tab**
- Full patient profile
- VIP Pass card (active/expired status, renewal button)
- Quick stats: upcoming, completed, missed visits

**Appointments Tab**
- Book appointments (date, time, type, doctor)
- Types: Consultation, Follow-up, Pharmacy Visit, Vaccination, Review
- Actions: Mark Complete / Missed / Cancelled
- Auto-marks past scheduled appointments as Missed

**Reminders Tab**
- Set reminders by date and time
- Types: Appointment, Medication, Follow-up, VIP Renewal, General
- Overdue reminders highlighted in orange
- Mark Done button

### VIP Pass System
- Enroll from registration form or patient detail page
- Start date: chosen date (defaults to today)
- End date: auto-calculated as start + 1 year
- End date is editable if needed
- Public VIP registration URL: `/vip-register`
- Sales team can share this link — no login required

### Dispensing (`/dispensing`)
1. Search medicine by brand or molecule
2. Add to cart — auto-selects best batch (nearest expiry, sufficient stock)
3. If out of stock — substitutes panel appears automatically
4. Upload prescription image → AI reads medicines → Review → Add to cart
5. Schedule H/H1/X drugs → compliance form appears automatically
6. Click **Generate Bill** → Preview modal (review before committing)
7. **Confirm & Dispense** → Bill saved, stock deducted, print modal opens
8. Print / Save as PDF

### Medicine Master (`/medicines`)
All fields from your pharmacy system:

| Field | Options/Type |
|---|---|
| Drug Name | Text |
| Drug Type (Dosage Form) | 19 types: Tablet, Capsule, Injection, Vial, Suspension, Drops, Powder, Syrup, Gel, Liquid, Lotion, Cream, Eye Drops, Ointment, Soap, Inhaler, Pill, Patch, Other |
| Generic Name (Molecule) | Text |
| Strength | Text (e.g. 500mg) |
| Rx Units | units / tsp / ml / drps / puff / mg / μg / g |
| Intake Route | Oral, Topical, Parenteral, Ophthalmic, Otic, Nasal, Inhalation, Sublingual, Rectal, Transdermal |
| Schedule Class | OTC / H / H1 / X |
| Category | Text (e.g. Antibiotic) |
| Stock Group | Text (therapeutic group) |
| Treatment For | Text (condition) |
| MRP | Amount in ₹ |
| Sale Rate | Amount in ₹ |
| GST % | Percentage |
| Discount % | Percentage |
| Rack Location | Text (e.g. A-12) |
| Reorder Qty | Number |
| Rx Required | Checkbox |
| Description / Notes | Text |

### Bill Format
Every printed bill includes:
- Clinic name, address, phone, GSTIN, Drug Licence No.
- Bill number (format: `BILL-YYYYMMDD-XXXX`), date, pharmacist
- Patient name, doctor name, doctor registration number
- Items table: Medicine, Batch No., Expiry, Qty, Rate, GST%, Amount
- Subtotal, GST total, Discount, **Net Total**
- Payment mode (CASH / CARD / UPI)
- Schedule drug notice (if applicable)
- Pharmacist signature line

---

# 8. API Reference

**Base URL (Development):** `http://localhost:3001`  
**Base URL (Production):** `https://your-domain.com/api`  
**Auth:** All endpoints except login and `/patients/vip-register` require:  
`Authorization: Bearer <jwt_token>`

## Endpoints Summary

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/login` | Login with mobile + password |
| GET | `/auth/me` | Get current user |

### Patients
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/patients/vip-register` | Public | VIP self-registration |
| GET | `/patients/stats` | JWT | Dashboard stats |
| GET | `/patients` | JWT | List all patients |
| POST | `/patients` | JWT | Register patient |
| GET | `/patients/:id` | JWT | Patient detail |
| PATCH | `/patients/:id` | JWT | Update patient |
| GET | `/patients/appointments/today` | JWT | Today's schedule |
| GET | `/patients/appointments/missed` | JWT | Missed visits |
| GET | `/patients/appointments/upcoming` | JWT | Upcoming visits |
| POST | `/patients/:id/appointments` | JWT | Book appointment |
| PATCH | `/patients/appointments/:id` | JWT | Update appointment status |
| POST | `/patients/:id/reminders` | JWT | Add reminder |
| PATCH | `/patients/reminders/:id/done` | JWT | Mark reminder done |

### Medicines
| Method | Endpoint | Description |
|---|---|---|
| GET | `/medicines` | List with search/filter |
| POST | `/medicines` | Add medicine |
| PATCH | `/medicines/:id` | Update medicine |
| PATCH | `/medicines/:id/deactivate` | Deactivate |

### Stock
| Method | Endpoint | Description |
|---|---|---|
| GET | `/stock` | Current stock list |
| GET | `/stock/:id/best-batch` | Best batch for dispensing |
| POST | `/stock/purchase` | Add new stock batch |
| POST | `/stock/adjust` | Manual adjustment |
| GET | `/stock/expiring` | Expiring medicines |
| GET/POST | `/stock/suppliers` | Supplier management |

### Sales
| Method | Endpoint | Description |
|---|---|---|
| GET | `/sales` | Bills with date/search filter |
| POST | `/sales` | Create bill (deducts stock) |
| GET | `/sales/:id` | Bill detail |
| POST | `/sales/:id/void` | Void bill (restores stock) |

### AI Prescription
| Method | Endpoint | Description |
|---|---|---|
| POST | `/ai/prescription/parse` | Upload image, start parsing |
| GET | `/ai/prescription/:id` | Poll for result |

---

# 9. Database Schema

## Tables Overview

| Table | Purpose |
|---|---|
| `users` | Staff accounts |
| `medicines` | Drug master |
| `stock_batches` | Stock inventory (batch-wise) |
| `suppliers` | Supplier records |
| `sales` | Bill headers |
| `sale_items` | Bill line items |
| `schedule_drug_logs` | Schedule H/H1/X compliance |
| `ai_prescriptions` | AI parse results |
| `stock_adjustments` | Manual adjustments |
| `bulk_activity_logs` | CSV import history |
| `patients` | Patient records |
| `patient_appointments` | Appointment bookings |
| `patient_reminders` | Patient reminders |

## Key Relationships

```
users ──────────────────── created sales, patients, appointments

medicines ──┬─────────────── many stock_batches
            └─────────────── many sale_items

stock_batches ───────────── many sale_items (batch referenced per sale)

sales ──┬────────────────── many sale_items
        └────────────────── many schedule_drug_logs

patients ──┬─────────────── many patient_appointments
           └─────────────── many patient_reminders
```

---

# 10. Deployment — Cloud Server

For 24/7 access from anywhere, deploy to a cloud server.

## Recommended Provider: Hetzner Cloud
- Website: https://www.hetzner.com/cloud
- Plan: CX22 (2 vCPU, 4GB RAM, 40GB SSD)
- Cost: ~€4.49/month (~₹400/month)
- Location: Singapore (closest to India)

## One-Time Setup Steps

### Step 1 — Create Hetzner Account
1. Go to https://www.hetzner.com/cloud
2. Sign up and add a payment method
3. Create new server: Ubuntu 22.04, CX22, Singapore
4. Note the server's IP address and root password

### Step 2 — Connect to Server from Your Mac
```bash
ssh root@YOUR_SERVER_IP
# Type: yes (when asked)
# Enter the password Hetzner emailed you
```

### Step 3 — Upload and Run Setup Script
On your **Mac** (second terminal):
```bash
scp "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/setup-server.sh" root@YOUR_SERVER_IP:/root/
```

Back on the **server**:
```bash
chmod +x /root/setup-server.sh
bash /root/setup-server.sh
```

The script will ask for:
- Database password
- JWT secret (or press Enter to auto-generate)
- Your OpenAI API key
- Your domain name (optional)

Takes ~25 minutes to complete.

### Step 4 — Upload Your Code
On your **Mac**:
```bash
bash "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/deploy-update.sh"
# Enter server IP when prompted
```

### Step 5 — Enable HTTPS (if you have a domain)
```bash
certbot --nginx -d your-domain.com
```

## Updating the Live App
Every time you make changes, run from your Mac:
```bash
bash "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/deploy-update.sh"
```

---

# 11. Moving the App to Another System

## Option A — Copy to Another Mac/PC

### Step 1 — Zip the Project (Exclude Large Folders)
```bash
cd "/Users/rejesh.kumar/Desktop/Project- AI"
zip -r medisyn.zip medisyn --exclude "*/node_modules/*" --exclude "*/.next/*" --exclude "*/dist/*"
```
Result: A small zip file (~5–10 MB) on your Desktop.

### Step 2 — Transfer the File
Use AirDrop, USB drive, Google Drive, or email.

### Step 3 — Set Up the New Machine
Install on the new computer:
```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@20

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14

# Create database
psql -U postgres -c "CREATE DATABASE medisyn;"
```

### Step 4 — Configure and Run
```bash
# Unzip
unzip medisyn.zip -d ~/Desktop/

# Configure backend
cd ~/Desktop/medisyn/apps/api
cp .env.example .env
# Edit .env with correct DB password and API keys

# Configure frontend
echo "NEXT_PUBLIC_API_URL=http://localhost:3001" > ../web/.env.local

# Install and start
npm install && npm run dev    # in apps/api
# (new terminal)
cd ~/Desktop/medisyn/apps/web
npm install && npm run dev
```

---

## Option B — Move the Database Too

If you have existing patient / medicine data:

### Export Data from Old Machine
```bash
pg_dump -U postgres medisyn > medisyn_data_backup.sql
```

### Import on New Machine
```bash
psql -U postgres medisyn < medisyn_data_backup.sql
```

---

# 12. Access Outside the Clinic Network

## Option 1 — Cloudflare Tunnel (Free, Laptop as Server)

Best for: testing, demos, small teams.  
Requires: Your Mac stays ON.

```bash
# Install
brew install cloudflared

# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create medisyn

# Start (exposes localhost:3000 to internet)
cloudflared tunnel --url http://localhost:3000
```
You get a URL like `https://proud-tiger-abc123.trycloudflare.com`  
Share this with anyone. They can access MediSyn from anywhere.

**Limitation:** URL changes every restart. Laptop must be ON.

---

## Option 2 — Cloud Server (Permanent, Professional)

Best for: daily use by multiple pharmacists, 24/7 availability.

- Hetzner CX22: ~₹400/month
- Custom domain: ~₹850/year
- HTTPS: Free

Full instructions in **Section 10** and `DEPLOYMENT_GUIDE.md`.

---

## Option 3 — ngrok (Quick Tunnel)

```bash
brew install ngrok
ngrok http 3000
```
Gets you a temporary public URL instantly.

---

# 13. Backup & Recovery

## Database Backup

### Manual Backup (Run Anytime)
```bash
pg_dump -U postgres medisyn > medisyn_backup_$(date +%Y%m%d).sql
```
This creates a file like `medisyn_backup_20260225.sql`.

### Restore from Backup
```bash
psql -U postgres medisyn < medisyn_backup_20260225.sql
```

### Recommended Backup Schedule
| Frequency | Type | Storage |
|---|---|---|
| Daily | Database dump | External drive / Google Drive |
| Weekly | Full project zip | External drive |
| Before any updates | Database dump | Local |

---

## Prescription Images Backup
Uploaded prescription images are stored at:
```
apps/api/uploads/
```
Copy this folder as part of your backup.

---

# 14. Troubleshooting

## App Won't Start

| Problem | Solution |
|---|---|
| `Error: listen EADDRINUSE :::3001` | Port already in use. Run: `lsof -ti:3001 \| xargs kill` |
| `Error: listen EADDRINUSE :::3000` | Run: `lsof -ti:3000 \| xargs kill` |
| `Cannot connect to database` | PostgreSQL not running. Run: `brew services start postgresql@14` |
| `Module not found` | Run: `npm install` in both `apps/api` and `apps/web` |

## Database Issues

| Problem | Solution |
|---|---|
| `role "postgres" does not exist` | Run: `createuser -s postgres` |
| `database "medisyn" does not exist` | Run: `psql -U postgres -c "CREATE DATABASE medisyn;"` |
| `password authentication failed` | Check DB_PASSWORD in `apps/api/.env` |
| TypeORM sync error (enum column) | Run: `psql -U postgres -d medisyn -f apps/api/src/database/patch-medicine-columns.sql` |

## Login Issues

| Problem | Solution |
|---|---|
| Can't log in | Check mobile number format (no spaces, no +91 prefix) |
| Invalid token error | Clear browser localStorage: `localStorage.clear()` in browser console |
| JWT expired | Log out and log back in |

## Production Server Issues

```bash
# Check if app is running
pm2 status

# View error logs
pm2 logs medisyn-api --lines 50
pm2 logs medisyn-web --lines 50

# Restart apps
pm2 restart all

# Check database
systemctl status postgresql

# Check Nginx
systemctl status nginx
nginx -t
```

---

# 15. Cost Summary

## Development (Running on Your Mac)

| Item | Cost |
|---|---|
| Node.js | Free |
| PostgreSQL | Free |
| Next.js / NestJS | Free (open source) |
| OpenAI API | Pay per use (~₹1–5 per prescription scan) |
| **Total** | **~₹0 + OpenAI usage** |

## Production (Cloud Hosting)

| Item | Monthly Cost |
|---|---|
| Hetzner CX22 Server | ~₹400 |
| Domain Name | ~₹70 (₹850/year) |
| SSL Certificate | ₹0 (free) |
| OpenAI API | ~₹200–500 (usage-based) |
| **Total** | **~₹670–970/month** |

---

# 16. Quick Reference Card

*Cut and keep this section at the front desk.*

---

## Starting MediSyn

**Terminal 1 — Backend:**
```
cd "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/apps/api"
npm run dev
```

**Terminal 2 — Frontend:**
```
cd "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/apps/web"
npm run dev
```

**Open browser:** http://localhost:3000

---

## Common Commands

| Task | Command | Where to Run |
|---|---|---|
| Start API | `npm run dev` | `apps/api/` |
| Start Web | `npm run dev` | `apps/web/` |
| Stop | `Ctrl + C` | In terminal |
| Backup DB | `pg_dump -U postgres medisyn > backup.sql` | Any terminal |
| Restore DB | `psql -U postgres medisyn < backup.sql` | Any terminal |
| Push to server | `bash deploy-update.sh` | Project root |
| Check server apps | `pm2 status` | SSH to server |
| Restart server apps | `pm2 restart all` | SSH to server |

---

## Important URLs

| URL | Purpose |
|---|---|
| http://localhost:3000 | MediSyn App |
| http://localhost:3001/api/docs | API Documentation |
| http://localhost:3000/vip-register | VIP Registration (public) |

---

## File Locations

| Item | Path |
|---|---|
| Project folder | `/Users/rejesh.kumar/Desktop/Project- AI/medisyn/` |
| Backend config | `apps/api/.env` |
| Frontend config | `apps/web/.env.local` |
| Uploaded images | `apps/api/uploads/` |
| Deployment guide | `DEPLOYMENT_GUIDE.md` |
| Developer handover | `CLAUDE_HANDOVER.md` |
| This document | `MEDISYN_COMPLETE_GUIDE.md` |

---

## Support & Development

To continue development with Claude AI:

1. Open Cursor IDE
2. Start a new chat
3. Say: *"Read the handover document at `/Users/rejesh.kumar/Desktop/Project- AI/medisyn/CLAUDE_HANDOVER.md` and continue development"*

---

*Document Version 1.0 — MediSyn Specialty Clinic, Taliparamba*  
*Prepared February 2026*
