-- Migration: Inventory Intelligence System
-- Purpose: Movement tracking, AI predictions, configurable thresholds
-- Date: 2026-05-16

-- ============================================================================
-- 1. INVENTORY MOVEMENT CONFIGURATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS inventory_movement_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Fast Moving Thresholds
    fast_moving_sales_count INTEGER NOT NULL DEFAULT 30,
    fast_moving_days INTEGER NOT NULL DEFAULT 7,
    fast_moving_description TEXT DEFAULT 'Sold 30+ times in 7 days',
    
    -- Slow Moving Thresholds
    slow_moving_sales_count_min INTEGER NOT NULL DEFAULT 1,
    slow_moving_sales_count_max INTEGER NOT NULL DEFAULT 10,
    slow_moving_days INTEGER NOT NULL DEFAULT 30,
    slow_moving_description TEXT DEFAULT 'Sold 1-10 times in 30 days',
    
    -- Dead Stock Thresholds
    dead_stock_days INTEGER NOT NULL DEFAULT 60,
    dead_stock_description TEXT DEFAULT 'No sales in 60 days',
    
    -- Seasonal Detection
    seasonal_variance_threshold DECIMAL(5,2) DEFAULT 0.5, -- 50% month-to-month variance
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT unique_tenant_config UNIQUE (tenant_id)
);

-- Default config for existing tenant
INSERT INTO inventory_movement_config (tenant_id)
SELECT id FROM tenants 
WHERE id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================================
-- 2. MEDICINE SALES VELOCITY TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS medicine_sales_velocity (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    
    -- Sales Metrics
    total_sales_count INTEGER DEFAULT 0,
    last_sale_date TIMESTAMP,
    first_sale_date TIMESTAMP,
    
    -- Velocity Calculations (auto-computed)
    avg_sales_per_day DECIMAL(10,2) DEFAULT 0,
    avg_sales_per_week DECIMAL(10,2) DEFAULT 0,
    avg_sales_per_month DECIMAL(10,2) DEFAULT 0,
    
    -- Movement Category (auto-computed)
    movement_category VARCHAR(20) CHECK (movement_category IN ('FAST', 'SLOW', 'DEAD', 'SEASONAL', 'NEW')),
    days_since_last_sale INTEGER,
    
    -- Trend Analysis
    last_7_days_sales INTEGER DEFAULT 0,
    last_30_days_sales INTEGER DEFAULT 0,
    last_90_days_sales INTEGER DEFAULT 0,
    sales_trend VARCHAR(20) CHECK (sales_trend IN ('RISING', 'STABLE', 'DECLINING', 'VOLATILE')),
    
    -- Seasonal Pattern Detection
    is_seasonal BOOLEAN DEFAULT FALSE,
    peak_months INTEGER[], -- Array of month numbers (1-12)
    
    -- Last Refresh
    last_calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_tenant_medicine_velocity UNIQUE (tenant_id, medicine_id)
);

CREATE INDEX idx_velocity_category ON medicine_sales_velocity(tenant_id, movement_category);
CREATE INDEX idx_velocity_trend ON medicine_sales_velocity(tenant_id, sales_trend);
CREATE INDEX idx_velocity_last_sale ON medicine_sales_velocity(tenant_id, last_sale_date);

-- ============================================================================
-- 3. AI PREDICTION HISTORY
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_stock_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    medicine_id UUID NOT NULL REFERENCES medicines(id),
    
    -- Prediction Type
    prediction_type VARCHAR(50) CHECK (prediction_type IN (
        'STOCKOUT_RISK', 
        'DEMAND_FORECAST', 
        'DEAD_STOCK_RISK',
        'REORDER_QUANTITY',
        'SEASONAL_DEMAND'
    )),
    
    -- Prediction Data
    prediction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    forecast_horizon_days INTEGER, -- 7, 30, 90 days
    
    -- Numerical Predictions
    predicted_demand DECIMAL(10,2),
    confidence_score DECIMAL(5,2), -- 0.00 to 1.00
    
    -- Risk Scores (0-100)
    stockout_risk_score INTEGER CHECK (stockout_risk_score BETWEEN 0 AND 100),
    dead_stock_risk_score INTEGER CHECK (dead_stock_risk_score BETWEEN 0 AND 100),
    
    -- AI Analysis
    ai_reasoning TEXT, -- Claude's explanation
    contributing_factors JSONB, -- {seasonal: true, trend: "declining", ...}
    
    -- Recommendations
    recommended_action VARCHAR(50), -- 'ORDER_NOW', 'REDUCE_STOCK', 'MONITOR', 'DISCONTINUE'
    recommended_quantity INTEGER,
    
    -- Current State Snapshot
    current_stock_quantity INTEGER,
    current_sales_velocity DECIMAL(10,2),
    
    -- Prediction Accuracy (filled later when actual data available)
    actual_demand INTEGER,
    prediction_error DECIMAL(10,2),
    accuracy_percentage DECIMAL(5,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    CONSTRAINT idx_pred_medicine_date UNIQUE (medicine_id, prediction_type, prediction_date)
);

CREATE INDEX idx_predictions_stockout ON ai_stock_predictions(tenant_id, stockout_risk_score DESC)
    WHERE stockout_risk_score > 70;
CREATE INDEX idx_predictions_dead_stock ON ai_stock_predictions(tenant_id, dead_stock_risk_score DESC)
    WHERE dead_stock_risk_score > 70;
CREATE INDEX idx_predictions_type ON ai_stock_predictions(tenant_id, prediction_type, prediction_date DESC);

-- ============================================================================
-- 4. FUNCTION: Calculate Sales Velocity for a Medicine
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_medicine_velocity(
    p_tenant_id UUID,
    p_medicine_id UUID
) RETURNS void AS $$
DECLARE
    v_config RECORD;
    v_total_sales INTEGER;
    v_first_sale TIMESTAMP;
    v_last_sale TIMESTAMP;
    v_days_active INTEGER;
    v_avg_daily DECIMAL(10,2);
    v_avg_weekly DECIMAL(10,2);
    v_avg_monthly DECIMAL(10,2);
    v_last_7 INTEGER;
    v_last_30 INTEGER;
    v_last_90 INTEGER;
    v_days_since_last INTEGER;
    v_category VARCHAR(20);
    v_trend VARCHAR(20);
BEGIN
    -- Get configuration
    SELECT * INTO v_config FROM inventory_movement_config WHERE tenant_id = p_tenant_id;
    
    -- Calculate sales metrics from bill_items
    SELECT 
        COUNT(*),
        MIN(b.created_at),
        MAX(b.created_at),
        EXTRACT(EPOCH FROM (MAX(b.created_at) - MIN(b.created_at))) / 86400.0
    INTO v_total_sales, v_first_sale, v_last_sale, v_days_active
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE bi.medicine_id = p_medicine_id 
        AND b.tenant_id = p_tenant_id
        AND b.status = 'PAID';
    
    -- If no sales, mark as NEW or DEAD
    IF v_total_sales IS NULL OR v_total_sales = 0 THEN
        INSERT INTO medicine_sales_velocity (
            tenant_id, medicine_id, movement_category, 
            total_sales_count, avg_sales_per_day, avg_sales_per_week, avg_sales_per_month
        ) VALUES (
            p_tenant_id, p_medicine_id, 'NEW',
            0, 0, 0, 0
        )
        ON CONFLICT (tenant_id, medicine_id) 
        DO UPDATE SET 
            movement_category = 'NEW',
            total_sales_count = 0,
            last_calculated_at = CURRENT_TIMESTAMP;
        RETURN;
    END IF;
    
    -- Calculate averages
    v_avg_daily := CASE 
        WHEN v_days_active > 0 THEN v_total_sales::DECIMAL / GREATEST(v_days_active, 1)
        ELSE 0 
    END;
    v_avg_weekly := v_avg_daily * 7;
    v_avg_monthly := v_avg_daily * 30;
    
    -- Recent sales counts
    SELECT COUNT(*) INTO v_last_7
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE bi.medicine_id = p_medicine_id 
        AND b.tenant_id = p_tenant_id
        AND b.status = 'PAID'
        AND b.created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';
    
    SELECT COUNT(*) INTO v_last_30
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE bi.medicine_id = p_medicine_id 
        AND b.tenant_id = p_tenant_id
        AND b.status = 'PAID'
        AND b.created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    SELECT COUNT(*) INTO v_last_90
    FROM bill_items bi
    JOIN bills b ON bi.bill_id = b.id
    WHERE bi.medicine_id = p_medicine_id 
        AND b.tenant_id = p_tenant_id
        AND b.status = 'PAID'
        AND b.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    -- Days since last sale
    v_days_since_last := EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - v_last_sale)) / 86400.0;
    
    -- Determine category
    IF v_days_since_last > v_config.dead_stock_days THEN
        v_category := 'DEAD';
    ELSIF v_last_7 >= v_config.fast_moving_sales_count THEN
        v_category := 'FAST';
    ELSIF v_last_30 >= v_config.slow_moving_sales_count_min 
          AND v_last_30 <= v_config.slow_moving_sales_count_max THEN
        v_category := 'SLOW';
    ELSE
        v_category := 'SLOW'; -- Default
    END IF;
    
    -- Determine trend
    IF v_last_7 > (v_last_30 / 4.0 * 1.2) THEN
        v_trend := 'RISING';
    ELSIF v_last_7 < (v_last_30 / 4.0 * 0.8) THEN
        v_trend := 'DECLINING';
    ELSE
        v_trend := 'STABLE';
    END IF;
    
    -- Upsert velocity record
    INSERT INTO medicine_sales_velocity (
        tenant_id, medicine_id,
        total_sales_count, first_sale_date, last_sale_date,
        avg_sales_per_day, avg_sales_per_week, avg_sales_per_month,
        movement_category, days_since_last_sale,
        last_7_days_sales, last_30_days_sales, last_90_days_sales,
        sales_trend, last_calculated_at
    ) VALUES (
        p_tenant_id, p_medicine_id,
        v_total_sales, v_first_sale, v_last_sale,
        v_avg_daily, v_avg_weekly, v_avg_monthly,
        v_category, v_days_since_last,
        v_last_7, v_last_30, v_last_90,
        v_trend, CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id, medicine_id)
    DO UPDATE SET
        total_sales_count = v_total_sales,
        first_sale_date = v_first_sale,
        last_sale_date = v_last_sale,
        avg_sales_per_day = v_avg_daily,
        avg_sales_per_week = v_avg_weekly,
        avg_sales_per_month = v_avg_monthly,
        movement_category = v_category,
        days_since_last_sale = v_days_since_last,
        last_7_days_sales = v_last_7,
        last_30_days_sales = v_last_30,
        last_90_days_sales = v_last_90,
        sales_trend = v_trend,
        last_calculated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 5. FUNCTION: Batch Calculate All Medicines Velocity
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_all_medicine_velocities(
    p_tenant_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_medicine RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_medicine IN 
        SELECT id FROM medicines WHERE tenant_id = p_tenant_id
    LOOP
        PERFORM calculate_medicine_velocity(p_tenant_id, v_medicine.id);
        v_count := v_count + 1;
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. TRIGGER: Auto-update velocity after sale
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_velocity_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger on bill PAID status
    IF NEW.status = 'PAID' AND (OLD IS NULL OR OLD.status != 'PAID') THEN
        -- Update velocity for all medicines in this bill
        PERFORM calculate_medicine_velocity(NEW.tenant_id, bi.medicine_id)
        FROM bill_items bi
        WHERE bi.bill_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS after_bill_paid_update_velocity ON bills;
CREATE TRIGGER after_bill_paid_update_velocity
    AFTER INSERT OR UPDATE ON bills
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_velocity_after_sale();

-- ============================================================================
-- 7. VIEWS: Quick Access to Categories
-- ============================================================================

-- Fast Moving Medicines
CREATE OR REPLACE VIEW v_fast_moving_medicines AS
SELECT 
    m.id,
    m.name,
    m.generic_name,
    v.avg_sales_per_day,
    v.avg_sales_per_week,
    v.avg_sales_per_month,
    v.last_7_days_sales,
    v.last_sale_date,
    v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'FAST'
GROUP BY m.id, m.name, m.generic_name, v.avg_sales_per_day, 
         v.avg_sales_per_week, v.avg_sales_per_month, v.last_7_days_sales,
         v.last_sale_date, v.sales_trend, m.tenant_id;

-- Slow Moving Medicines
CREATE OR REPLACE VIEW v_slow_moving_medicines AS
SELECT 
    m.id,
    m.name,
    m.generic_name,
    v.avg_sales_per_day,
    v.avg_sales_per_month,
    v.last_30_days_sales,
    v.last_sale_date,
    v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    COALESCE(SUM(sb.quantity * sb.mrp), 0) as stock_value,
    m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'SLOW'
GROUP BY m.id, m.name, m.generic_name, v.avg_sales_per_day,
         v.avg_sales_per_month, v.last_30_days_sales, v.last_sale_date,
         v.sales_trend, m.tenant_id;

-- Dead Stock
CREATE OR REPLACE VIEW v_dead_stock_medicines AS
SELECT 
    m.id,
    m.name,
    m.generic_name,
    v.days_since_last_sale,
    v.last_sale_date,
    v.total_sales_count,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    COALESCE(SUM(sb.quantity * sb.cost_price), 0) as cost_value_locked,
    COALESCE(SUM(sb.quantity * sb.mrp), 0) as mrp_value_locked,
    MIN(sb.expiry_date) as earliest_expiry,
    m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'DEAD'
GROUP BY m.id, m.name, m.generic_name, v.days_since_last_sale,
         v.last_sale_date, v.total_sales_count, m.tenant_id;

-- High Risk Stockout (Fast moving + Low stock)
CREATE OR REPLACE VIEW v_stockout_risk_medicines AS
SELECT 
    m.id,
    m.name,
    m.generic_name,
    v.avg_sales_per_day,
    v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    CASE 
        WHEN v.avg_sales_per_day > 0 THEN 
            COALESCE(SUM(sb.quantity), 0) / v.avg_sales_per_day
        ELSE 999
    END as days_of_stock_remaining,
    CASE 
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 3 THEN 'CRITICAL'
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 7 THEN 'HIGH'
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 14 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level,
    m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'FAST'
GROUP BY m.id, m.name, m.generic_name, v.avg_sales_per_day, v.sales_trend, m.tenant_id
HAVING COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 14
ORDER BY days_of_stock_remaining ASC;

-- ============================================================================
-- 8. INITIAL DATA POPULATION
-- ============================================================================

-- Calculate velocity for all existing medicines (run once)
-- This will be called via API endpoint, not here
-- SELECT refresh_all_medicine_velocities('00000000-0000-0000-0000-000000000001');

COMMENT ON TABLE inventory_movement_config IS 'Configurable thresholds for inventory movement categorization';
COMMENT ON TABLE medicine_sales_velocity IS 'Tracks sales velocity and movement category for each medicine';
COMMENT ON TABLE ai_stock_predictions IS 'AI-powered predictions for stock management';
COMMENT ON FUNCTION calculate_medicine_velocity IS 'Calculates velocity metrics for a single medicine';
COMMENT ON FUNCTION refresh_all_medicine_velocities IS 'Batch calculates velocity for all medicines in tenant';
