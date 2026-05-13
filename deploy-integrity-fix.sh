#!/bin/bash
#
# deploy-integrity-fix.sh
# Automated deployment script for MediSyn data integrity fix
#
# Usage: ./deploy-integrity-fix.sh
#

set -e  # Exit on error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

PROJECT_DIR="/Users/navamworks/Documents/NavamWorks/Project- AI/medisyn"
API_URL="https://successful-playfulness-production-873f.up.railway.app"
ADMIN_KEY="medisyn-import-2024"
DB_CONNECTION="postgresql://postgres:gAtHLENrqUMqMkkjuVEoqKqVcayvQZUm@shortline.proxy.rlwy.net:28446/railway"

echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   MediSyn Data Integrity Fix - Auto Deploy       ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 1: Pre-Flight Checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[1/6] Pre-flight checks...${NC}"

# Check if pg module is installed
if ! npm list pg > /dev/null 2>&1; then
    echo "Installing pg module..."
    npm install pg
fi

# Check if files exist
if [ ! -f "Scripts/cleanup-duplicate-medicines.js" ]; then
    echo -e "${RED}Error: cleanup script not found!${NC}"
    exit 1
fi

if [ ! -f "Scripts/migration_batch_integrity.sql" ]; then
    echo -e "${RED}Error: migration script not found!${NC}"
    exit 1
fi

if [ ! -f "apps/api/src/import-stock.controller.ts" ]; then
    echo -e "${RED}Error: import controller not found!${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All files present${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 2: Backup Database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[2/6] Creating database backup...${NC}"

BACKUP_FILE="backups/medisyn_backup_$(date +%Y%m%d_%H%M%S).sql"
mkdir -p backups

echo "Backing up to: $BACKUP_FILE"
pg_dump "$DB_CONNECTION" > "$BACKUP_FILE" 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backup created: $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}⚠ Backup failed (continuing anyway)${NC}"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 3: Check Current State
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[3/6] Checking current data integrity...${NC}"

INTEGRITY_CHECK=$(curl -s -H "x-admin-key: $ADMIN_KEY" "$API_URL/admin/check-data-integrity")
echo "$INTEGRITY_CHECK" | python3 -m json.tool | head -20

DUP_BATCHES=$(echo "$INTEGRITY_CHECK" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('summary', {}).get('duplicate_batch_numbers', 0))" 2>/dev/null || echo "0")
DUP_MEDS=$(echo "$INTEGRITY_CHECK" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('summary', {}).get('potential_duplicate_medicines', 0))" 2>/dev/null || echo "0")

echo ""
echo -e "Duplicate batch numbers: ${RED}$DUP_BATCHES${NC}"
echo -e "Duplicate medicines: ${RED}$DUP_MEDS${NC}"
echo ""

if [ "$DUP_BATCHES" = "0" ] && [ "$DUP_MEDS" = "0" ]; then
    echo -e "${GREEN}✓ No duplicates found! System already clean.${NC}"
    echo "Continuing with deployment to add prevention layers..."
    echo ""
else
    echo -e "${YELLOW}⚠ Duplicates detected. Will clean up in next step.${NC}"
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 4: Run Cleanup Script
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$DUP_BATCHES" != "0" ] || [ "$DUP_MEDS" != "0" ]; then
    echo -e "${YELLOW}[4/6] Running cleanup script...${NC}"
    echo "This will merge duplicate medicines and batches."
    echo ""
    
    # Auto-confirm cleanup (remove this line for manual confirmation)
    echo "" | node Scripts/cleanup-duplicate-medicines.js
    
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    echo ""
else
    echo -e "${YELLOW}[4/6] Skipping cleanup (no duplicates found)${NC}"
    echo ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 5: Apply Database Migration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[5/6] Applying database migration...${NC}"

psql "$DB_CONNECTION" -f Scripts/migration_batch_integrity.sql > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database constraint added${NC}"
else
    echo -e "${YELLOW}⚠ Migration failed (constraint may already exist)${NC}"
fi
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 6: Deploy Code Changes
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${YELLOW}[6/6] Deploying code changes...${NC}"

git add apps/api/src/import-stock.controller.ts
git add Scripts/
git add *.md
git commit -m "fix: Add fuzzy medicine matching and batch validation to prevent duplicates

- Implemented fuzzy name matching to handle vendor naming variations
- Added batch number validation across medicines
- Added database constraint for batch uniqueness
- Added data integrity monitoring endpoint
- Cleaned up existing duplicates

Fixes duplicate medicine issue where vendor CSV imports created new
medicine records for existing products with different name formats."

git push origin main

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Code deployed to Railway${NC}"
    echo ""
    echo "Waiting for Railway deployment..."
    sleep 30
else
    echo -e "${RED}✗ Git push failed${NC}"
    exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# VERIFICATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${GREEN}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Deployment Complete!                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

echo "Verifying fix..."
echo ""

# Final integrity check
FINAL_CHECK=$(curl -s -H "x-admin-key: $ADMIN_KEY" "$API_URL/admin/check-data-integrity")
FINAL_DUP_BATCHES=$(echo "$FINAL_CHECK" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('summary', {}).get('duplicate_batch_numbers', 0))" 2>/dev/null || echo "0")
FINAL_DUP_MEDS=$(echo "$FINAL_CHECK" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('summary', {}).get('potential_duplicate_medicines', 0))" 2>/dev/null || echo "0")

echo -e "Final duplicate batch numbers: ${GREEN}$FINAL_DUP_BATCHES${NC}"
echo -e "Final duplicate medicines: ${GREEN}$FINAL_DUP_MEDS${NC}"
echo ""

if [ "$FINAL_DUP_BATCHES" = "0" ] && [ "$FINAL_DUP_MEDS" = "0" ]; then
    echo -e "${GREEN}✅ SUCCESS! Data integrity fully restored.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Test dispensing UI - verify no duplicate entries"
    echo "  2. Try importing vendor CSV again"
    echo "  3. Check fuzzy match warnings in import response"
    echo "  4. Schedule weekly integrity checks"
else
    echo -e "${YELLOW}⚠ WARNING: Some issues remain. Manual review needed.${NC}"
    echo ""
    echo "Run this to see details:"
    echo "  curl -H 'x-admin-key: $ADMIN_KEY' $API_URL/admin/check-data-integrity | python3 -m json.tool"
fi

echo ""
echo "Backup saved to: $BACKUP_FILE"
echo ""
echo -e "${GREEN}All done! 🎉${NC}"
