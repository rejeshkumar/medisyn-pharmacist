#!/bin/bash

# MediSyn Inventory Intelligence System - Deployment Script
# Run this from the inventory-intelligence-system directory

set -e  # Exit on error

echo "🚀 MediSyn Inventory Intelligence Deployment Script"
echo "=================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project root (adjust if needed)
PROJECT_ROOT=~/Desktop/Project-\ AI/medisyn

echo -e "${YELLOW}Step 1: Verifying project directory...${NC}"
if [ ! -d "$PROJECT_ROOT" ]; then
    echo -e "${RED}❌ Project directory not found at $PROJECT_ROOT${NC}"
    echo "Please update PROJECT_ROOT variable in this script"
    exit 1
fi
echo -e "${GREEN}✓ Project directory found${NC}"
echo ""

echo -e "${YELLOW}Step 2: Copying backend files...${NC}"
mkdir -p "$PROJECT_ROOT/apps/api/src/inventory/dto"
mkdir -p "$PROJECT_ROOT/apps/api/src/inventory/services"
mkdir -p "$PROJECT_ROOT/apps/api/src/inventory/controllers"

cp migration_inventory_intelligence.sql "$PROJECT_ROOT/apps/api/src/migrations/"
cp inventory-intelligence.dto.ts "$PROJECT_ROOT/apps/api/src/inventory/dto/"
cp inventory-intelligence.service.ts "$PROJECT_ROOT/apps/api/src/inventory/services/"
cp inventory-intelligence.controller.ts "$PROJECT_ROOT/apps/api/src/inventory/controllers/"
echo -e "${GREEN}✓ Backend files copied${NC}"
echo ""

echo -e "${YELLOW}Step 3: Copying frontend files...${NC}"
mkdir -p "$PROJECT_ROOT/apps/web/app/(dashboard)/inventory/intelligence/config"
cp frontend/intelligence-page.tsx "$PROJECT_ROOT/apps/web/app/(dashboard)/inventory/intelligence/page.tsx"
cp frontend/config-page.tsx "$PROJECT_ROOT/apps/web/app/(dashboard)/inventory/intelligence/config/page.tsx"
echo -e "${GREEN}✓ Frontend files copied${NC}"
echo ""

echo -e "${YELLOW}Step 4: Copying documentation...${NC}"
cp INVENTORY_INTELLIGENCE_GUIDE.md "$PROJECT_ROOT/"
echo -e "${GREEN}✓ Documentation copied${NC}"
echo ""

echo -e "${GREEN}=================================================="
echo "✅ All files copied successfully!"
echo "==================================================${NC}"
echo ""

echo -e "${YELLOW}⚠️  NEXT MANUAL STEPS:${NC}"
echo ""
echo "1. Run database migration:"
echo "   psql \"postgresql://postgres:[password]@shortline.proxy.rlwy.net:28446/railway\" \\"
echo "        -f $PROJECT_ROOT/apps/api/src/migrations/migration_inventory_intelligence.sql"
echo ""
echo "2. Calculate initial velocities (in psql):"
echo "   SELECT refresh_all_medicine_velocities('00000000-0000-0000-0000-000000000001');"
echo ""
echo "3. Update inventory.module.ts to include new service and controller"
echo ""
echo "4. Verify ANTHROPIC_API_KEY in Railway:"
echo "   Should be: sk-ant-api03-..."
echo "   NOT: sk-your-anthropic-api-key-here"
echo ""
echo "5. Deploy to Railway:"
echo "   cd $PROJECT_ROOT"
echo "   git add ."
echo "   git commit -m \"feat: Inventory intelligence system with AI predictions\""
echo "   git push origin main"
echo ""
echo -e "${GREEN}📖 See INVENTORY_INTELLIGENCE_GUIDE.md for detailed instructions${NC}"
