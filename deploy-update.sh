#!/bin/bash

# =============================================================================
#  MediSyn — Deploy Update Script
#  Run this from YOUR MAC whenever you want to push changes to the server.
#  Usage: bash deploy-update.sh
# =============================================================================

set -e

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()     { echo -e "${GREEN}[✔]${NC} $1"; }
info()    { echo -e "${BLUE}[→]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
error()   { echo -e "${RED}[✘] ERROR:${NC} $1"; exit 1; }
section() { echo -e "\n${BOLD}${CYAN}── $1 ──${NC}\n"; }

# ── Check this is being run from a Mac/local machine ─────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR"

if [ ! -d "$PROJECT_DIR/apps/api" ] || [ ! -d "$PROJECT_DIR/apps/web" ]; then
  error "Run this script from inside the medisyn project folder on your Mac."
fi

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     MediSyn — Deploy Update Script        ║"
echo "  ║     Run from your Mac to push updates     ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# ── Get server IP ─────────────────────────────────────────────────────────────
section "Server Details"

read -p "  Enter your server IP address (e.g. 123.45.67.89): " SERVER_IP

if [ -z "$SERVER_IP" ]; then
  error "Server IP is required."
fi

# Validate IP format loosely
if ! [[ "$SERVER_IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  error "That doesn't look like a valid IP address. Example: 123.45.67.89"
fi

info "Testing connection to server..."
if ! ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no root@"$SERVER_IP" "echo connected" > /dev/null 2>&1; then
  error "Cannot connect to server at $SERVER_IP. Check the IP and make sure the server is running."
fi
log "Connected to server at $SERVER_IP"

# ── Confirm before deploying ──────────────────────────────────────────────────
echo ""
echo -e "  ${YELLOW}This will upload your local MediSyn code to:${NC}"
echo -e "  ${BOLD}root@${SERVER_IP}:/var/www/medisyn/${NC}"
echo ""
read -p "  Continue? (y/n): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  echo "Deployment cancelled."
  exit 0
fi

# ── Upload code ───────────────────────────────────────────────────────────────
section "Uploading Code"

info "Uploading project files (skipping node_modules, build files)..."
rsync -az --progress \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='dist' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='apps/api/uploads/*' \
  "$PROJECT_DIR/" \
  "root@${SERVER_IP}:/var/www/medisyn/"

log "Code uploaded successfully"

# ── Build and restart on the server ──────────────────────────────────────────
section "Building & Restarting App on Server"

info "Running build and restart on server..."
ssh -o StrictHostKeyChecking=no root@"$SERVER_IP" "bash /root/deploy.sh"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${GREEN}  ✅  Deployment complete!${NC}"
echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  Your app is live at:"
echo -e "  ${BOLD}http://${SERVER_IP}:3000${NC}  (Web App)"
echo -e "  ${BOLD}http://${SERVER_IP}:3001/api/docs${NC}  (API Docs)"
echo ""
echo -e "  ${YELLOW}If you have a domain configured with Nginx, use:${NC}"
echo -e "  ${BOLD}https://your-domain.com${NC}"
echo ""
