-- ══════════════════════════════════════════════════════════════
-- VIP Security & Payment Enhancement Migration
-- ══════════════════════════════════════════════════════════════

BEGIN;

-- 1. Create sales_agents table
CREATE TABLE IF NOT EXISTS sales_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  agent_name VARCHAR(100) NOT NULL,
  agent_code VARCHAR(50) NOT NULL, -- URL-safe code like 'akshaya_kannur'
  access_token VARCHAR(100) NOT NULL UNIQUE, -- Security token for URL
  mobile VARCHAR(15),
  email VARCHAR(100),
  commission_rate DECIMAL(5,2) DEFAULT 10.00, -- 10% commission
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID,
  UNIQUE(tenant_id, agent_code)
);

CREATE INDEX idx_sales_agents_tenant ON sales_agents(tenant_id);
CREATE INDEX idx_sales_agents_token ON sales_agents(access_token);

-- 2. Add payment fields to patients table
ALTER TABLE patients 
  ADD COLUMN IF NOT EXISTS vip_payment_method VARCHAR(20), -- 'upi' or 'cash'
  ADD COLUMN IF NOT EXISTS vip_payment_amount DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS vip_payment_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS vip_upi_txn_id VARCHAR(50); -- UPI transaction reference

-- 3. Create vip_registrations tracking table (for rate limiting & analytics)
CREATE TABLE IF NOT EXISTS vip_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  patient_id UUID REFERENCES patients(id),
  agent_id UUID REFERENCES sales_agents(id),
  vip_category VARCHAR(20) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  payment_amount DECIMAL(10,2) NOT NULL,
  upi_txn_id VARCHAR(50),
  registered_at TIMESTAMP DEFAULT NOW(),
  ip_address VARCHAR(50)
);

CREATE INDEX idx_vip_reg_tenant ON vip_registrations(tenant_id);
CREATE INDEX idx_vip_reg_agent ON vip_registrations(agent_id);
CREATE INDEX idx_vip_reg_date ON vip_registrations(registered_at);

-- 4. Seed default sales agents
INSERT INTO sales_agents (tenant_id, agent_name, agent_code, access_token, mobile, commission_rate)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Akshaya Taliparamba', 'akshaya_taliparamba', 'AKT_' || substr(md5(random()::text), 1, 16), '9876543210', 10.00),
  ('00000000-0000-0000-0000-000000000001', 'Akshaya Payyanur', 'akshaya_payyanur', 'AKP_' || substr(md5(random()::text), 1, 16), '9876543211', 10.00),
  ('00000000-0000-0000-0000-000000000001', 'Rejesh Kumar', 'rejesh_kumar', 'RK_' || substr(md5(random()::text), 1, 16), '9876543212', 15.00)
ON CONFLICT (tenant_id, agent_code) DO NOTHING;

COMMIT;

-- Show created tokens
SELECT agent_name, agent_code, access_token, 
  CONCAT('https://medisynweb-production.up.railway.app/vip-register?agent=', agent_code, '&token=', access_token) as registration_link
FROM sales_agents 
WHERE tenant_id = '00000000-0000-0000-0000-000000000001';

