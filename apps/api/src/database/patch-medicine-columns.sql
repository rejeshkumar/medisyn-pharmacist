-- =============================================================================
-- MediSyn — Medicine Table Column Patch
-- Run this ONCE in psql if you get a TypeORM sync error about dosage_form
-- =============================================================================
-- This converts the old PostgreSQL ENUM column to a flexible VARCHAR,
-- and adds all the new medicine fields.

-- Step 1: Convert dosage_form from enum to varchar
ALTER TABLE medicines ALTER COLUMN dosage_form TYPE varchar(50) USING dosage_form::text;

-- Step 2: Add new columns (safe to run multiple times — checks first)
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS rx_units       varchar(20);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS stock_group    varchar(255);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS treatment_for  varchar(255);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS description    text;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS discount_percent decimal(5,2) DEFAULT 0;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS rack_location  varchar(255);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS intake_route   varchar(50);
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS reorder_qty    integer DEFAULT 0;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS is_rx_required boolean DEFAULT false;

-- Done!
SELECT 'Medicine table patched successfully.' AS result;
