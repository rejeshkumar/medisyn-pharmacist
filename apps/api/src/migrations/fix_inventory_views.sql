DROP VIEW IF EXISTS v_fast_moving_medicines CASCADE;
DROP VIEW IF EXISTS v_slow_moving_medicines CASCADE;
DROP VIEW IF EXISTS v_dead_stock_medicines CASCADE;
DROP VIEW IF EXISTS v_stockout_risk_medicines CASCADE;
DROP TRIGGER IF EXISTS after_sale_paid_update_velocity ON sales;
DROP FUNCTION IF EXISTS trigger_update_velocity_after_sale();

CREATE OR REPLACE FUNCTION trigger_update_velocity_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM calculate_medicine_velocity(NEW.tenant_id, si.medicine_id)
    FROM sale_items si WHERE si.sale_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER after_sale_paid_update_velocity
    AFTER INSERT OR UPDATE ON sales
    FOR EACH ROW EXECUTE FUNCTION trigger_update_velocity_after_sale();

CREATE OR REPLACE VIEW v_fast_moving_medicines AS
SELECT 
    m.id, m.brand_name as name, m.molecule as generic_name,
    v.avg_sales_per_day, v.avg_sales_per_week, v.avg_sales_per_month,
    v.last_7_days_sales, v.last_sale_date, v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock, m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'FAST'
GROUP BY m.id, m.brand_name, m.molecule, v.avg_sales_per_day, v.avg_sales_per_week, v.avg_sales_per_month, v.last_7_days_sales, v.last_sale_date, v.sales_trend, m.tenant_id;

CREATE OR REPLACE VIEW v_slow_moving_medicines AS
SELECT 
    m.id, m.brand_name as name, m.molecule as generic_name,
    v.avg_sales_per_day, v.avg_sales_per_month, v.last_30_days_sales,
    v.last_sale_date, v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    COALESCE(SUM(sb.quantity * sb.mrp), 0) as stock_value, m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'SLOW'
GROUP BY m.id, m.brand_name, m.molecule, v.avg_sales_per_day, v.avg_sales_per_month, v.last_30_days_sales, v.last_sale_date, v.sales_trend, m.tenant_id;

CREATE OR REPLACE VIEW v_dead_stock_medicines AS
SELECT 
    m.id, m.brand_name as name, m.molecule as generic_name,
    v.days_since_last_sale, v.last_sale_date, v.total_sales_count,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    COALESCE(SUM(sb.quantity * sb.cost_price), 0) as cost_value_locked,
    COALESCE(SUM(sb.quantity * sb.mrp), 0) as mrp_value_locked,
    MIN(sb.expiry_date) as earliest_expiry, m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'DEAD'
GROUP BY m.id, m.brand_name, m.molecule, v.days_since_last_sale, v.last_sale_date, v.total_sales_count, m.tenant_id;

CREATE OR REPLACE VIEW v_stockout_risk_medicines AS
SELECT 
    m.id, m.brand_name as name, m.molecule as generic_name,
    v.avg_sales_per_day, v.sales_trend,
    COALESCE(SUM(sb.quantity), 0) as current_stock,
    CASE WHEN v.avg_sales_per_day > 0 THEN COALESCE(SUM(sb.quantity), 0) / v.avg_sales_per_day ELSE 999 END as days_of_stock_remaining,
    CASE 
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 3 THEN 'CRITICAL'
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 7 THEN 'HIGH'
        WHEN COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 14 THEN 'MEDIUM'
        ELSE 'LOW'
    END as risk_level, m.tenant_id
FROM medicines m
JOIN medicine_sales_velocity v ON m.id = v.medicine_id
LEFT JOIN stock_batches sb ON m.id = sb.medicine_id AND sb.quantity > 0
WHERE v.movement_category = 'FAST'
GROUP BY m.id, m.brand_name, m.molecule, v.avg_sales_per_day, v.sales_trend, m.tenant_id
HAVING COALESCE(SUM(sb.quantity), 0) / NULLIF(v.avg_sales_per_day, 0) < 14
ORDER BY days_of_stock_remaining ASC;
