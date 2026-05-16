import { IsNumber, IsString, IsOptional, Min, Max } from 'class-validator';

export class UpdateInventoryConfigDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  fast_moving_sales_count?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  fast_moving_days?: number;

  @IsString()
  @IsOptional()
  fast_moving_description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  slow_moving_sales_count_min?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  slow_moving_sales_count_max?: number;

  @IsNumber()
  @Min(1)
  @IsOptional()
  slow_moving_days?: number;

  @IsString()
  @IsOptional()
  slow_moving_description?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  dead_stock_days?: number;

  @IsString()
  @IsOptional()
  dead_stock_description?: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @IsOptional()
  seasonal_variance_threshold?: number;
}

export class MovementCategoryResponseDto {
  id: string;
  name: string;
  generic_name?: string;
  movement_category: 'FAST' | 'SLOW' | 'DEAD' | 'SEASONAL' | 'NEW';
  avg_sales_per_day: number;
  avg_sales_per_week: number;
  avg_sales_per_month: number;
  last_7_days_sales: number;
  last_30_days_sales: number;
  last_sale_date?: Date;
  days_since_last_sale?: number;
  sales_trend?: 'RISING' | 'STABLE' | 'DECLINING' | 'VOLATILE';
  current_stock: number;
  stock_value?: number;
  cost_value_locked?: number;
  mrp_value_locked?: number;
  earliest_expiry?: Date;
  days_of_stock_remaining?: number;
  risk_level?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export class AIPredictionRequestDto {
  @IsString()
  medicine_id: string;

  @IsString()
  @IsOptional()
  prediction_type?: 'STOCKOUT_RISK' | 'DEMAND_FORECAST' | 'DEAD_STOCK_RISK' | 'REORDER_QUANTITY' | 'SEASONAL_DEMAND';

  @IsNumber()
  @Min(1)
  @Max(90)
  @IsOptional()
  forecast_horizon_days?: number;
}

export class AIPredictionResponseDto {
  id: string;
  medicine_id: string;
  medicine_name: string;
  prediction_type: string;
  prediction_date: Date;
  forecast_horizon_days: number;
  predicted_demand?: number;
  confidence_score: number;
  stockout_risk_score?: number;
  dead_stock_risk_score?: number;
  ai_reasoning: string;
  contributing_factors: any;
  recommended_action: string;
  recommended_quantity?: number;
  current_stock_quantity: number;
  current_sales_velocity: number;
}
