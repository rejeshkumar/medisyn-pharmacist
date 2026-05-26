-- WhatsApp Templates Table
-- Run this in psql against your Railway database

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type      VARCHAR(60) NOT NULL,
  template_name   VARCHAR(120) NOT NULL,
  message_body    TEXT NOT NULL,
  variables       JSONB NOT NULL DEFAULT '[]',
  is_active       BOOLEAN NOT NULL DEFAULT true,
  language        VARCHAR(10) NOT NULL DEFAULT 'en',
  send_to         VARCHAR(20) NOT NULL DEFAULT 'patient',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, event_type, send_to)
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_tenant_event
  ON whatsapp_templates(tenant_id, event_type, is_active);

COMMENT ON COLUMN whatsapp_templates.event_type IS
  'bill_generated | patient_registered | prescription_ready | refill_reminder | appointment_confirmed | low_stock_alert | payment_received';
COMMENT ON COLUMN whatsapp_templates.send_to IS
  'patient | owner | both';
COMMENT ON COLUMN whatsapp_templates.variables IS
  'Array of variable names available in this template, e.g. ["patient_name","bill_number","amount"]';
