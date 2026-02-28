#!/bin/bash

# =============================================================================
#  MediSyn — Automated Server Setup Script
#  Run this ONCE on a fresh Ubuntu 22.04 server
#  Usage: bash setup-server.sh
# =============================================================================

set -e  # Stop on any error

# ── Colors for readable output ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ── Helper functions ──────────────────────────────────────────────────────────
log()     { echo -e "${GREEN}[✔]${NC} $1"; }
info()    { echo -e "${BLUE}[→]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘] ERROR:${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; echo -e "${BOLD}${CYAN}  $1${NC}"; echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"; }

# ── Check we are root ─────────────────────────────────────────────────────────
if [ "$EUID" -ne 0 ]; then
  error "Please run as root: sudo bash setup-server.sh"
fi

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     MediSyn — Server Setup Script         ║"
echo "  ║     MediSyn Specialty Clinic, Taliparamba ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"
echo "  This script will install and configure everything"
echo "  needed to run MediSyn on this server."
echo ""

# ── Gather user input ─────────────────────────────────────────────────────────
section "Step 1/7 — Configuration"

echo -e "${YELLOW}Please answer the following questions:${NC}\n"

# Database password
while true; do
  read -s -p "  Enter a database password (min 8 chars): " DB_PASSWORD
  echo ""
  if [ ${#DB_PASSWORD} -ge 8 ]; then
    break
  else
    warn "Password must be at least 8 characters. Try again."
  fi
done

# JWT Secret (auto-generate if blank)
read -p "  Enter a JWT secret (press Enter to auto-generate): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
  JWT_SECRET=$(openssl rand -base64 48)
  log "JWT secret auto-generated"
fi

# OpenAI API Key
read -p "  Enter your OpenAI API Key (sk-...): " OPENAI_API_KEY
if [ -z "$OPENAI_API_KEY" ]; then
  warn "No OpenAI key entered. AI prescription features will not work."
  OPENAI_API_KEY="sk-replace-with-your-key"
fi

# Domain name
read -p "  Enter your domain name (or press Enter to use IP only): " DOMAIN_NAME
USE_DOMAIN=false
if [ -n "$DOMAIN_NAME" ]; then
  USE_DOMAIN=true
  log "Domain: $DOMAIN_NAME"
else
  warn "No domain entered. App will be accessible via IP address only."
fi

echo ""
log "Configuration collected. Starting setup..."
sleep 2

# ─────────────────────────────────────────────────────────────────────────────
section "Step 2/7 — System Update & Security"

info "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq
log "System updated"

info "Installing essential tools..."
apt-get install -y -qq \
  curl wget git unzip nano htop ufw fail2ban \
  build-essential software-properties-common \
  openssl
log "Essential tools installed"

info "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    comment 'SSH'
ufw allow 80/tcp    comment 'HTTP'
ufw allow 443/tcp   comment 'HTTPS'
ufw --force enable
log "Firewall configured (ports 22, 80, 443 open)"

info "Enabling automatic security updates..."
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades
log "Automatic security updates enabled"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 3/7 — Install Node.js 20"

info "Adding Node.js 20 repository..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
apt-get install -y -qq nodejs
log "Node.js $(node --version) installed"
log "npm $(npm --version) installed"

info "Installing PM2 (process manager)..."
npm install -g pm2 --silent
log "PM2 $(pm2 --version) installed"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 4/7 — Install PostgreSQL Database"

info "Installing PostgreSQL 14..."
apt-get install -y -qq postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql
log "PostgreSQL installed and started"

info "Creating MediSyn database and user..."
sudo -u postgres psql <<SQL
CREATE DATABASE medisyn;
CREATE USER medisyn_user WITH PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE medisyn TO medisyn_user;
ALTER DATABASE medisyn OWNER TO medisyn_user;
SQL
log "Database 'medisyn' and user 'medisyn_user' created"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 5/7 — Install Nginx (Web Traffic Manager)"

info "Installing Nginx..."
apt-get install -y -qq nginx
systemctl enable nginx
systemctl start nginx
log "Nginx installed and started"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 6/7 — Create Application Directory & Environment Files"

info "Creating application directory..."
mkdir -p /var/www/medisyn/apps/api
mkdir -p /var/www/medisyn/apps/web
mkdir -p /var/www/medisyn/apps/api/uploads
chmod -R 755 /var/www/medisyn
log "Directory /var/www/medisyn created"

# Get server's public IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
log "Server IP detected: $SERVER_IP"

# Determine the public URL
if [ "$USE_DOMAIN" = true ]; then
  PUBLIC_URL="https://${DOMAIN_NAME}"
  API_URL="https://${DOMAIN_NAME}/api"
else
  PUBLIC_URL="http://${SERVER_IP}"
  API_URL="http://${SERVER_IP}:3001"
fi

info "Creating API environment file..."
cat > /var/www/medisyn/apps/api/.env <<EOF
# ── Database ──────────────────────────────────────────────────────────────────
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=medisyn_user
DB_PASSWORD=${DB_PASSWORD}
DB_DATABASE=medisyn

# ── Authentication ────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=8h

# ── Application ───────────────────────────────────────────────────────────────
PORT=3001
NODE_ENV=production

# ── OpenAI ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY=${OPENAI_API_KEY}

# ── File Storage ──────────────────────────────────────────────────────────────
STORAGE_PROVIDER=local
LOCAL_UPLOAD_PATH=./uploads
EOF
log "API .env file created"

info "Creating Web environment file..."
cat > /var/www/medisyn/apps/web/.env.local <<EOF
NEXT_PUBLIC_API_URL=${API_URL}
EOF
log "Web .env.local file created"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 7/7 — Create Helper Scripts"

info "Creating deploy script..."
cat > /root/deploy.sh <<'DEPLOY_SCRIPT'
#!/bin/bash
set -e

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

APP_DIR="/var/www/medisyn"
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

info "Installing API dependencies..."
cd "$APP_DIR/apps/api"
npm install --production=false --silent
log "API dependencies installed"

info "Building API..."
npm run build
log "API built"

info "Running database migrations..."
npm run migration:run 2>/dev/null || true
log "Migrations done (or skipped if none)"

info "Installing Web dependencies..."
cd "$APP_DIR/apps/web"
npm install --production=false --silent
log "Web dependencies installed"

info "Building Web app..."
npm run build
log "Web app built"

info "Starting/restarting with PM2..."
pm2 delete medisyn-api 2>/dev/null || true
pm2 delete medisyn-web 2>/dev/null || true

pm2 start npm --name "medisyn-api" \
  --cwd "$APP_DIR/apps/api" \
  -- start

pm2 start npm --name "medisyn-web" \
  --cwd "$APP_DIR/apps/web" \
  -- start

pm2 save
log "PM2 services started"

echo ""
echo -e "${GREEN}✅ MediSyn is live!${NC}"
echo -e "   API:  http://${SERVER_IP}:3001"
echo -e "   Web:  http://${SERVER_IP}:3000"
echo -e "   API Docs: http://${SERVER_IP}:3001/api/docs"
DEPLOY_SCRIPT

chmod +x /root/deploy.sh
log "deploy.sh created at /root/deploy.sh"

# ── Nginx config script ───────────────────────────────────────────────────────
info "Creating Nginx configuration script..."
cat > /root/configure-nginx.sh <<'NGINX_SCRIPT'
#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[✔]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }

read -p "Enter your domain name (e.g. medisyn.yourclinic.com): " DOMAIN

if [ -z "$DOMAIN" ]; then
  warn "No domain entered. Skipping Nginx configuration."
  exit 0
fi

cat > /etc/nginx/sites-available/medisyn <<NGINX_CONF
server {
    listen 80;
    server_name ${DOMAIN};

    client_max_body_size 20M;

    # API routes
    location /api/ {
        proxy_pass         http://127.0.0.1:3001/;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    # Uploaded files (prescriptions)
    location /uploads/ {
        proxy_pass http://127.0.0.1:3001/uploads/;
        proxy_set_header Host \$host;
    }

    # Frontend (Next.js)
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_CONF

# Enable the site
ln -sf /etc/nginx/sites-available/medisyn /etc/nginx/sites-enabled/medisyn
rm -f /etc/nginx/sites-enabled/default

# Test and reload
nginx -t
systemctl reload nginx
log "Nginx configured for domain: $DOMAIN"
echo ""
echo "Next step — run: certbot --nginx -d ${DOMAIN}"
NGINX_SCRIPT

chmod +x /root/configure-nginx.sh
log "configure-nginx.sh created at /root/configure-nginx.sh"

# ── Install Certbot ───────────────────────────────────────────────────────────
info "Installing Certbot (for free HTTPS)..."
apt-get install -y -qq certbot python3-certbot-nginx
log "Certbot installed"

# ── PM2 startup on reboot ─────────────────────────────────────────────────────
info "Configuring PM2 to start on server reboot..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root > /dev/null 2>&1
log "PM2 startup configured"

# ── Protect sensitive files ───────────────────────────────────────────────────
chmod 600 /var/www/medisyn/apps/api/.env
chmod 600 /var/www/medisyn/apps/web/.env.local
log "Environment files secured (read by root only)"

# ─────────────────────────────────────────────────────────────────────────────
# Final summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  MediSyn server setup complete!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Server IP:${NC}        $SERVER_IP"
if [ "$USE_DOMAIN" = true ]; then
echo -e "  ${BOLD}Domain:${NC}           $DOMAIN_NAME"
fi
echo -e "  ${BOLD}Database:${NC}         medisyn (user: medisyn_user)"
echo ""
echo -e "  ${BOLD}${YELLOW}Next Steps:${NC}"
echo -e "  ${YELLOW}1.${NC} Upload your code:  Run deploy-update.sh from your Mac"
echo -e "  ${YELLOW}2.${NC} Build & start:     bash /root/deploy.sh"
if [ "$USE_DOMAIN" = true ]; then
echo -e "  ${YELLOW}3.${NC} Setup domain:      bash /root/configure-nginx.sh"
echo -e "  ${YELLOW}4.${NC} Enable HTTPS:      certbot --nginx -d $DOMAIN_NAME"
fi
echo ""
echo -e "  ${BOLD}Saved credentials in:${NC} /root/medisyn-credentials.txt"
echo ""

# Save credentials to file
cat > /root/medisyn-credentials.txt <<CREDS
MediSyn Server Credentials
===========================
Generated: $(date)

Server IP:        $SERVER_IP
Domain:           ${DOMAIN_NAME:-"(not set)"}

Database:
  Host:           localhost
  Database:       medisyn
  Username:       medisyn_user
  Password:       ${DB_PASSWORD}

API URL:          ${API_URL}
Web URL:          ${PUBLIC_URL}

Files:
  App directory:  /var/www/medisyn
  API .env:       /var/www/medisyn/apps/api/.env
  Web .env:       /var/www/medisyn/apps/web/.env.local

Scripts:
  Deploy app:     bash /root/deploy.sh
  Setup Nginx:    bash /root/configure-nginx.sh
CREDS

chmod 600 /root/medisyn-credentials.txt
log "Credentials saved to /root/medisyn-credentials.txt"
