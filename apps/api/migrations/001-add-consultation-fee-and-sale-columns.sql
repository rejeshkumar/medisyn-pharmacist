-- Migration: Add consultation_fee and related columns for patient lifecycle features
-- Run this on Railway PostgreSQL when deploying (synchronize is disabled in production)
-- Usage: Copy and run in Railway Dashboard → Your Project → PostgreSQL → Query tab

-- 1. Add consultation_fee to users table (for doctors)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2) DEFAULT 0;

-- 2. Add consultation_fee and prescription_id to sales table
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2) DEFAULT 0;

ALTER TABLE sales
ADD COLUMN IF NOT EXISTS prescription_id UUID;
