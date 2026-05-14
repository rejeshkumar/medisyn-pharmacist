-- ═══════════════════════════════════════════════════════════════
-- VIP Commission Structure Update: Fixed Amounts per Plan
-- ═══════════════════════════════════════════════════════════════

-- Drop the percentage-based commission_rate column
ALTER TABLE sales_agents DROP COLUMN IF EXISTS commission_rate;

-- Add fixed commission columns for each plan
ALTER TABLE sales_agents 
  ADD COLUMN commission_individual DECIMAL(10,2) DEFAULT 99.00,
  ADD COLUMN commission_family DECIMAL(10,2) DEFAULT 149.00,
  ADD COLUMN commission_extended DECIMAL(10,2) DEFAULT 199.00;

-- Update all agents with the standard commission structure
UPDATE sales_agents 
SET 
  commission_individual = 99.00,
  commission_family = 149.00,
  commission_extended = 199.00
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

-- Add helpful comment
COMMENT ON COLUMN sales_agents.commission_individual IS 'Fixed commission for ₹599 Individual plan';
COMMENT ON COLUMN sales_agents.commission_family IS 'Fixed commission for ₹999 Family plan';
COMMENT ON COLUMN sales_agents.commission_extended IS 'Fixed commission for ₹1499 Extended plan';

