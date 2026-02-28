# MediSyn — Production Deployment Guide

**Document Version:** 1.0  
**Application:** MediSyn Pharmacist App  
**Prepared for:** MediSyn Specialty Clinic, Taliparamba  
**Date:** February 2026

---

## Table of Contents

1. [What This Document Covers](#1-what-this-document-covers)
2. [Hardware & Cost Requirements](#2-hardware--cost-requirements)
3. [What You Need Before Starting](#3-what-you-need-before-starting)
4. [Phase 1 — Rent a Cloud Server (20 min)](#4-phase-1--rent-a-cloud-server-20-min)
5. [Phase 2 — Run the Automated Setup Script (30 min)](#5-phase-2--run-the-automated-setup-script-30-min)
6. [Phase 3 — Upload Your App (10 min)](#6-phase-3--upload-your-app-10-min)
7. [Phase 4 — Enable HTTPS & Domain (15 min)](#7-phase-4--enable-https--domain-15-min)
8. [Phase 5 — Verify Everything Works](#8-phase-5--verify-everything-works)
9. [Day-to-Day Operations](#9-day-to-day-operations)
10. [Updating the App](#10-updating-the-app)
11. [Troubleshooting](#11-troubleshooting)
12. [Security Checklist](#12-security-checklist)

---

## 1. What This Document Covers

This guide walks you through making the MediSyn app accessible from **anywhere in the world** — not just from the clinic's local network. After following this guide:

- Pharmacists can log in from **any device, any location**
- The app runs **24 hours a day, 7 days a week** without your Mac needing to be on
- The connection is **encrypted and secure** (HTTPS)
- Everything is hosted on a **professional cloud server** for ~₹500/month

---

## 2. Hardware & Cost Requirements

### Your Own Equipment (What You Already Have)

| Item | Requirement |
|---|---|
| Mac / PC | Any computer with internet access |
| Internet | Any broadband connection (only needed to upload code) |
| Terminal app | Pre-installed on every Mac (search "Terminal" in Spotlight) |

> You do **not** need any new physical hardware. The "server" is a computer you rent in a data center.

---

### Cloud Server to Rent (Monthly)

| Specification | Value |
|---|---|
| Provider | Hetzner Cloud (hetzner.com) |
| Server Plan | CX22 |
| CPU | 2 vCores |
| RAM | 4 GB |
| SSD Storage | 40 GB |
| Monthly Traffic | 20 TB |
| Operating System | Ubuntu 22.04 LTS |
| **Monthly Cost** | **~€4.49/month (~₹400/month)** |

---

### Domain Name (Optional but Recommended)

| Item | Cost |
|---|---|
| Domain (e.g., `medisyn.yourclinic.com`) | ~$10/year (~₹850/year) |
| SSL Certificate (HTTPS) | **Free** via Let's Encrypt |

---

### Total Monthly Cost Summary

| Item | Cost |
|---|---|
| Hetzner CX22 Server | ~₹400/month |
| Domain Name | ~₹70/month (₹850/year) |
| SSL Certificate | ₹0 (Free) |
| **Grand Total** | **~₹470/month** |

---

## 3. What You Need Before Starting

Collect the following before you begin:

| # | Item | Where to Get It |
|---|---|---|
| 1 | Hetzner account | [hetzner.com](https://hetzner.com) — sign up free |
| 2 | Credit/debit card | For Hetzner billing (~₹400/month) |
| 3 | Domain name | [namecheap.com](https://namecheap.com) — ~₹850/year |
| 4 | OpenAI API Key | [platform.openai.com](https://platform.openai.com) — your existing key |
| 5 | Your Mac's Terminal | Press `Cmd + Space`, type "Terminal", press Enter |

---

## 4. Phase 1 — Rent a Cloud Server (20 min)

### Step 1 — Create a Hetzner Account

1. Go to [https://www.hetzner.com/cloud](https://www.hetzner.com/cloud)
2. Click **"Get Started"** and create an account
3. Verify your email address
4. Add a payment method (credit/debit card)

---

### Step 2 — Create a New Server

1. Log in to Hetzner Cloud Console
2. Click **"+ Create Server"**
3. Fill in the settings:

| Setting | Choose This |
|---|---|
| Location | Singapore (closest to India) |
| Image (OS) | Ubuntu 22.04 |
| Type | Shared vCPU — x86 |
| Plan | **CX22** (2 vCPU, 4GB RAM) |
| SSH Keys | Skip for now (use password) |
| Name | `medisyn-server` |

4. Click **"Create & Buy Now"**
5. Wait ~30 seconds for the server to start

---

### Step 3 — Save Your Server Details

After creation, Hetzner will show:

```
IPv4 Address:  123.45.67.89        ← Write this down
Root Password: (sent to your email)  ← Write this down
```

> **Important:** Save both the IP address and root password somewhere safe (e.g., in a notes app).

---

### Step 4 — Point Your Domain to the Server (If You Have a Domain)

1. Log in to your domain registrar (e.g., Namecheap)
2. Go to **DNS Settings** for your domain
3. Add an **A Record**:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` or `medisyn` | `123.45.67.89` | Automatic |

4. Wait 5–30 minutes for it to take effect

---

## 5. Phase 2 — Run the Automated Setup Script (30 min)

This phase uses the `setup-server.sh` script included in your project. It automatically installs everything needed on the server.

### Step 1 — Open Terminal on Your Mac

Press `Cmd + Space`, type **Terminal**, press Enter.

---

### Step 2 — Connect to Your Server

Type the following (replace `123.45.67.89` with your actual server IP):

```bash
ssh root@123.45.67.89
```

- Type **`yes`** when asked "Are you sure you want to continue connecting?"
- Enter the password Hetzner emailed you

You are now inside your cloud server. It will look like:

```
root@medisyn-server:~#
```

---

### Step 3 — Upload and Run the Setup Script

**Open a second Terminal window on your Mac** (`Cmd + T` or `Cmd + N`), then run:

```bash
scp "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/setup-server.sh" root@123.45.67.89:/root/
```

Go back to the **first Terminal** (connected to the server) and run:

```bash
chmod +x /root/setup-server.sh
bash /root/setup-server.sh
```

The script will ask you a few questions:
- **Database password** — Choose a strong password (e.g., `MediSyn@2026#`)
- **JWT Secret** — Press Enter to auto-generate one
- **Your domain name** — e.g., `medisyn.yourclinic.com` (or press Enter to use IP only)

The script runs for about **20–25 minutes**. You will see progress messages. When done, you'll see:

```
✅ MediSyn server setup complete!
```

---

## 6. Phase 3 — Upload Your App (10 min)

### Step 1 — Update CORS Settings

Before uploading, you need to tell the app your production domain. On your **Mac**, open:

```
/Users/rejesh.kumar/Desktop/Project- AI/medisyn/apps/api/src/main.ts
```

Find this section (around line 11):

```typescript
app.enableCors({
  origin: ['http://localhost:3000', 'http://localhost:3002'],
  credentials: true,
});
```

Change it to (replace with your actual domain):

```typescript
app.enableCors({
  origin: [
    'http://localhost:3000',
    'https://medisyn.yourclinic.com',
  ],
  credentials: true,
});
```

Save the file.

---

### Step 2 — Upload the Project to the Server

In your **Mac Terminal**, run:

```bash
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='dist' \
  "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/" \
  root@123.45.67.89:/var/www/medisyn/
```

This uploads your code (skipping large unnecessary folders). Takes about 2–5 minutes.

---

### Step 3 — Build and Start the App on the Server

Back on your **server Terminal**, run:

```bash
bash /root/deploy.sh
```

This script will:
1. Install all dependencies
2. Build the frontend and backend
3. Start both apps with PM2 (the auto-restart manager)

When done, you'll see:

```
✅ MediSyn is live!
   API:  http://123.45.67.89:3001
   Web:  http://123.45.67.89:3000
```

---

## 7. Phase 4 — Enable HTTPS & Domain (15 min)

> Skip this phase if you don't have a domain and want to use the IP address directly.

### Step 1 — Configure Nginx for Your Domain

On the **server Terminal**, run:

```bash
bash /root/configure-nginx.sh
```

Enter your domain name when asked (e.g., `medisyn.yourclinic.com`).

---

### Step 2 — Get a Free SSL Certificate

On the **server Terminal**, run:

```bash
certbot --nginx -d medisyn.yourclinic.com
```

Follow the prompts:
1. Enter your email address
2. Agree to terms (type `Y`)
3. Choose whether to share email (type `N`)

Certbot will automatically set up HTTPS. When done:

```
✅ Your app is now live at https://medisyn.yourclinic.com
```

---

## 8. Phase 5 — Verify Everything Works

Open a browser and go to your URL. Check each item:

| Check | Expected Result |
|---|---|
| `https://medisyn.yourclinic.com` | Login page appears |
| Log in with admin credentials | Dashboard loads |
| Upload a prescription (AI feature) | Parses correctly |
| Access from mobile phone (different network) | Works correctly |
| Access from home network | Works correctly |

---

## 9. Day-to-Day Operations

### Checking if the App is Running

Connect to server and run:

```bash
ssh root@123.45.67.89
pm2 status
```

You should see both `medisyn-api` and `medisyn-web` with status **`online`**.

---

### Restarting the App

```bash
pm2 restart all
```

---

### Viewing App Logs (if something seems broken)

```bash
pm2 logs medisyn-api   # Backend logs
pm2 logs medisyn-web   # Frontend logs
```

---

### Checking Server Resources

```bash
htop
```
Press `q` to exit.

---

## 10. Updating the App

Whenever you make changes to MediSyn and want to push them live, use the update script from your **Mac**:

```bash
bash "/Users/rejesh.kumar/Desktop/Project- AI/medisyn/deploy-update.sh"
```

Enter your server IP when asked. The script will:
1. Upload only changed files
2. Rebuild the app
3. Restart services with zero downtime

---

## 11. Troubleshooting

### App is not loading / shows error

```bash
ssh root@123.45.67.89
pm2 logs --lines 50
```

Look for red error lines and note them down.

---

### Cannot connect to server via SSH

- Check that you're using the correct IP address
- Make sure Hetzner firewall allows port 22 (SSH) — it does by default

---

### Database connection error

```bash
ssh root@123.45.67.89
systemctl status postgresql
```

If it says "inactive", run:

```bash
systemctl start postgresql
```

---

### SSL certificate expired

Certbot auto-renews certificates. To manually renew:

```bash
certbot renew
systemctl reload nginx
```

---

### App is slow / running out of memory

```bash
ssh root@123.45.67.89
free -h     # Check RAM usage
df -h       # Check disk space
```

If RAM is consistently above 80%, consider upgrading to **CX32** on Hetzner (~€7/month).

---

## 12. Security Checklist

Before going live, confirm each item below:

- [ ] Root password changed to something strong (done by setup script)
- [ ] PostgreSQL database is not accessible from the internet (only locally)
- [ ] HTTPS is enabled and HTTP redirects to HTTPS
- [ ] JWT secret is a long random string (not the default)
- [ ] OpenAI API key is stored only in server `.env` file
- [ ] Firewall allows only ports 22 (SSH), 80 (HTTP), 443 (HTTPS)
- [ ] Automatic OS security updates enabled (done by setup script)
- [ ] PM2 auto-start on reboot is configured (done by setup script)

---

## Appendix — Important File Locations on the Server

| Item | Path |
|---|---|
| Application code | `/var/www/medisyn/` |
| API environment variables | `/var/www/medisyn/apps/api/.env` |
| Web environment variables | `/var/www/medisyn/apps/web/.env.local` |
| Nginx configuration | `/etc/nginx/sites-available/medisyn` |
| Uploaded prescription files | `/var/www/medisyn/apps/api/uploads/` |
| PM2 logs | `~/.pm2/logs/` |
| SSL certificates | `/etc/letsencrypt/live/yourdomain.com/` |

---

## Appendix — Useful Commands Quick Reference

| Task | Command |
|---|---|
| Connect to server | `ssh root@YOUR_IP` |
| Check app status | `pm2 status` |
| Restart all apps | `pm2 restart all` |
| View live logs | `pm2 logs` |
| Restart Nginx | `systemctl reload nginx` |
| Restart database | `systemctl restart postgresql` |
| Check disk space | `df -h` |
| Check RAM usage | `free -h` |
| Renew SSL certificate | `certbot renew` |

---

*Document prepared for MediSyn Specialty Clinic, Taliparamba. For technical support, contact your system administrator.*
