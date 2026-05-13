-- migration_batch_integrity.sql
-- Add unique constraint to prevent duplicate batch numbers across the system
-- Run this AFTER cleaning up existing duplicates

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Add unique constraint on (batch_number, tenant_id)
-- ══════════════════════════════════════════════════════════════════════════════

-- This prevents the same batch number from being assigned to different medicines
-- Note: Same batch_number CAN exist for different tenants (multi-tenant isolation)

ALTER TABLE stock_batches 
ADD CONSTRAINT uq_batch_number_per_tenant 
UNIQUE (batch_number, tenant_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Create index for faster batch lookups
-- ══════════════════════════════════════════════════════════════════════════════

-- This index supports the common query pattern: lookup by batch number
CREATE INDEX IF NOT EXISTS idx_stock_batches_batch_number 
ON stock_batches(batch_number, tenant_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Add validation function to ensure data quality
-- ══════════════════════════════════════════════════════════════════════════════

-- Function to check for potential data integrity issues
CREATE OR REPLACE FUNCTION check_medicine_data_integrity()
RETURNS TABLE (
  issue_type TEXT,
  batch_number VARCHAR,
  medicine_count BIGINT,
  medicine_names TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'duplicate_batch_across_medicines'::TEXT as issue_type,
    sb.batch_number,
    COUNT(DISTINCT sb.medicine_id) as medicine_count,
    array_agg(DISTINCT m.brand_name) as medicine_names
  FROM stock_batches sb
  JOIN medicines m ON m.id = sb.medicine_id
  GROUP BY sb.batch_number, sb.tenant_id
  HAVING COUNT(DISTINCT sb.medicine_id) > 1;
END;
$$ LANGUAGE plpgsql;

-- Usage: SELECT * FROM check_medicine_data_integrity();

-- ══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Add comments for documentation
-- ══════════════════════════════════════════════════════════════════════════════

COMMENT ON CONSTRAINT uq_batch_number_per_tenant ON stock_batches IS 
'Ensures batch numbers are globally unique within a tenant. A batch number should represent a single physical batch from a manufacturer, not multiple different medicines.';

COMMENT ON FUNCTION check_medicine_data_integrity() IS 
'Diagnostic function to detect data integrity issues. Run periodically or after bulk imports to ensure data quality.';
