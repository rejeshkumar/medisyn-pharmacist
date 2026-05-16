import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import {
  UpdateInventoryConfigDto,
  MovementCategoryResponseDto,
  AIPredictionRequestDto,
  AIPredictionResponseDto,
} from '../dto/inventory-intelligence.dto';

@Injectable()
export class InventoryIntelligenceService {
  private readonly logger = new Logger(InventoryIntelligenceService.name);
  private anthropic: Anthropic;

  constructor(
    private dataSource: DataSource,
  ) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || apiKey.startsWith('sk-your-')) {
      this.logger.warn('⚠️  ANTHROPIC_API_KEY not configured properly - AI predictions will fail');
    }
    this.anthropic = new Anthropic({
      apiKey: apiKey || 'dummy-key',
    });
  }

  async getInventoryConfig(tenantId: string) {
    const result = await this.dataSource.query(
      `SELECT * FROM inventory_movement_config WHERE tenant_id = $1`,
      [tenantId]
    );
    return result[0] || null;
  }

  async updateInventoryConfig(tenantId: string, userId: string, dto: UpdateInventoryConfigDto) {
    const existing = await this.getInventoryConfig(tenantId);
    
    if (!existing) {
      await this.dataSource.query(
        `INSERT INTO inventory_movement_config (tenant_id, updated_by) VALUES ($1, $2)`,
        [tenantId, userId]
      );
    }

    const updates = [];
    const values = [];
    let idx = 1;

    for (const [key, value] of Object.entries(dto)) {
      if (value !== undefined) {
        updates.push(`${key} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (updates.length > 0) {
      values.push(userId);
      values.push(tenantId);
      await this.dataSource.query(
        `UPDATE inventory_movement_config 
         SET ${updates.join(', ')}, updated_by = $${idx}, updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = $${idx + 1}`,
        values
      );
    }

    return this.getInventoryConfig(tenantId);
  }

  async refreshMedicineVelocity(tenantId: string, medicineId: string) {
    this.logger.log(`Refreshing velocity for medicine ${medicineId}`);
    await this.dataSource.query(
      `SELECT calculate_medicine_velocity($1, $2)`,
      [tenantId, medicineId]
    );
  }

  async refreshAllVelocities(tenantId: string): Promise<number> {
    this.logger.log(`Refreshing velocity for all medicines in tenant ${tenantId}`);
    const result = await this.dataSource.query(
      `SELECT refresh_all_medicine_velocities($1) as count`,
      [tenantId]
    );
    const count = result[0]?.count || 0;
    this.logger.log(`✅ Refreshed velocity for ${count} medicines`);
    return count;
  }

  async getFastMovingMedicines(tenantId: string): Promise<MovementCategoryResponseDto[]> {
    const results = await this.dataSource.query(
      `SELECT * FROM v_fast_moving_medicines WHERE tenant_id = $1 ORDER BY avg_sales_per_day DESC`,
      [tenantId]
    );
    return results;
  }

  async getSlowMovingMedicines(tenantId: string): Promise<MovementCategoryResponseDto[]> {
    const results = await this.dataSource.query(
      `SELECT * FROM v_slow_moving_medicines WHERE tenant_id = $1 ORDER BY stock_value DESC`,
      [tenantId]
    );
    return results;
  }

  async getDeadStockMedicines(tenantId: string): Promise<MovementCategoryResponseDto[]> {
    const results = await this.dataSource.query(
      `SELECT * FROM v_dead_stock_medicines WHERE tenant_id = $1 ORDER BY cost_value_locked DESC`,
      [tenantId]
    );
    return results;
  }

  async getStockoutRiskMedicines(tenantId: string): Promise<MovementCategoryResponseDto[]> {
    const results = await this.dataSource.query(
      `SELECT * FROM v_stockout_risk_medicines WHERE tenant_id = $1 ORDER BY days_of_stock_remaining ASC`,
      [tenantId]
    );
    return results;
  }

  async getMovementSummary(tenantId: string) {
    const [fast, slow, dead, risk] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(current_stock), 0) as total_stock 
         FROM v_fast_moving_medicines WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(current_stock), 0) as total_stock,
                COALESCE(SUM(stock_value), 0) as total_value
         FROM v_slow_moving_medicines WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.dataSource.query(
        `SELECT COUNT(*) as count, COALESCE(SUM(current_stock), 0) as total_stock,
                COALESCE(SUM(cost_value_locked), 0) as cost_locked,
                COALESCE(SUM(mrp_value_locked), 0) as mrp_locked
         FROM v_dead_stock_medicines WHERE tenant_id = $1`,
        [tenantId]
      ),
      this.dataSource.query(
        `SELECT risk_level, COUNT(*) as count 
         FROM v_stockout_risk_medicines WHERE tenant_id = $1
         GROUP BY risk_level`,
        [tenantId]
      ),
    ]);

    return {
      fast_moving: {
        count: parseInt(fast[0]?.count || 0),
        total_stock: parseInt(fast[0]?.total_stock || 0),
      },
      slow_moving: {
        count: parseInt(slow[0]?.count || 0),
        total_stock: parseInt(slow[0]?.total_stock || 0),
        total_value: parseFloat(slow[0]?.total_value || 0),
      },
      dead_stock: {
        count: parseInt(dead[0]?.count || 0),
        total_stock: parseInt(dead[0]?.total_stock || 0),
        cost_locked: parseFloat(dead[0]?.cost_locked || 0),
        mrp_locked: parseFloat(dead[0]?.mrp_locked || 0),
      },
      stockout_risk: risk.reduce((acc, r) => {
        acc[r.risk_level.toLowerCase()] = parseInt(r.count);
        return acc;
      }, { critical: 0, high: 0, medium: 0 }),
    };
  }

  async generateAIPrediction(
    tenantId: string,
    dto: AIPredictionRequestDto
  ): Promise<AIPredictionResponseDto> {
    const { medicine_id, prediction_type = 'STOCKOUT_RISK', forecast_horizon_days = 7 } = dto;

    const medicineData = await this.dataSource.query(
      `SELECT 
        m.id, m.brand_name as name, m.molecule as generic_name, m.category,
        v.avg_sales_per_day, v.avg_sales_per_week, v.avg_sales_per_month,
        v.last_7_days_sales, v.last_30_days_sales, v.last_90_days_sales,
        v.movement_category, v.sales_trend, v.days_since_last_sale,
        COALESCE(SUM(sb.quantity), 0) as current_stock,
        ARRAY_AGG(sb.expiry_date ORDER BY sb.expiry_date) FILTER (WHERE sb.quantity > 0) as expiry_dates
      FROM medicines m
      LEFT JOIN medicine_sales_velocity v ON m.id = v.medicine_id
      LEFT JOIN stock_batches sb ON m.id = sb.medicine_id
      WHERE m.id = $1 AND m.tenant_id = $2
      GROUP BY m.id, m.brand_name, m.molecule, m.category,
               v.avg_sales_per_day, v.avg_sales_per_week, v.avg_sales_per_month,
               v.last_7_days_sales, v.last_30_days_sales, v.last_90_days_sales,
               v.movement_category, v.sales_trend, v.days_since_last_sale`,
      [medicine_id, tenantId]
    );

    if (!medicineData || medicineData.length === 0) {
      throw new Error('Medicine not found');
    }

    const medicine = medicineData[0];

    const salesHistory = await this.dataSource.query(
      `SELECT 
        DATE(s.created_at + INTERVAL '5 hours 30 minutes') as sale_date,
        COUNT(*) as sale_count,
        SUM(si.qty) as total_quantity
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE si.medicine_id = $1 
        AND s.tenant_id = $2
        AND s.created_at >= CURRENT_TIMESTAMP - INTERVAL '90 days'
      GROUP BY DATE(s.created_at + INTERVAL '5 hours 30 minutes')
      ORDER BY sale_date DESC`,
      [medicine_id, tenantId]
    );

    const prompt = this.buildAIPredictionPrompt(
      medicine,
      salesHistory,
      prediction_type,
      forecast_horizon_days
    );

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const aiResponse = response.content[0].type === 'text' ? response.content[0].text : '';

      let prediction;
      try {
        const cleanJson = aiResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        prediction = JSON.parse(cleanJson);
      } catch (e) {
        this.logger.error('Failed to parse AI response as JSON', e);
        throw new Error('AI response was not valid JSON');
      }

      const saved = await this.dataSource.query(
        `INSERT INTO ai_stock_predictions (
          tenant_id, medicine_id, prediction_type, forecast_horizon_days,
          predicted_demand, confidence_score, stockout_risk_score, dead_stock_risk_score,
          ai_reasoning, contributing_factors, recommended_action, recommended_quantity,
          current_stock_quantity, current_sales_velocity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          tenantId,
          medicine_id,
          prediction_type,
          forecast_horizon_days,
          prediction.predicted_demand || null,
          prediction.confidence_score || 0.5,
          prediction.stockout_risk_score || null,
          prediction.dead_stock_risk_score || null,
          prediction.reasoning || '',
          JSON.stringify(prediction.contributing_factors || {}),
          prediction.recommended_action || 'MONITOR',
          prediction.recommended_quantity || null,
          parseInt(medicine.current_stock),
          parseFloat(medicine.avg_sales_per_day || 0),
        ]
      );

      return {
        id: saved[0].id,
        medicine_id: medicine.id,
        medicine_name: medicine.name,
        prediction_type,
        prediction_date: saved[0].prediction_date,
        forecast_horizon_days,
        predicted_demand: prediction.predicted_demand,
        confidence_score: prediction.confidence_score,
        stockout_risk_score: prediction.stockout_risk_score,
        dead_stock_risk_score: prediction.dead_stock_risk_score,
        ai_reasoning: prediction.reasoning,
        contributing_factors: prediction.contributing_factors,
        recommended_action: prediction.recommended_action,
        recommended_quantity: prediction.recommended_quantity,
        current_stock_quantity: parseInt(medicine.current_stock),
        current_sales_velocity: parseFloat(medicine.avg_sales_per_day || 0),
      };
    } catch (error) {
      this.logger.error('AI prediction failed', error);
      throw new Error(`AI prediction failed: ${error.message}`);
    }
  }

  private buildAIPredictionPrompt(
    medicine: any,
    salesHistory: any[],
    predictionType: string,
    forecastHorizon: number
  ): string {
    const today = new Date();
    const dayOfWeek = today.toLocaleDateString('en-IN', { weekday: 'long' });
    const month = today.toLocaleDateString('en-IN', { month: 'long' });

    return `You are an AI assistant for a pharmacy in Taliparamba, Kerala, India. Analyze the following medicine inventory data and provide a ${predictionType} prediction.

**Medicine Information:**
- Name: ${medicine.name}
- Generic: ${medicine.generic_name || 'N/A'}
- Category: ${medicine.category || 'N/A'}
- Current Stock: ${medicine.current_stock} units
- Movement Category: ${medicine.movement_category || 'UNKNOWN'}

**Sales Velocity:**
- Average sales per day: ${medicine.avg_sales_per_day || 0}
- Average sales per week: ${medicine.avg_sales_per_week || 0}
- Average sales per month: ${medicine.avg_sales_per_month || 0}
- Last 7 days sales: ${medicine.last_7_days_sales || 0}
- Last 30 days sales: ${medicine.last_30_days_sales || 0}
- Last 90 days sales: ${medicine.last_90_days_sales || 0}
- Sales trend: ${medicine.sales_trend || 'UNKNOWN'}
- Days since last sale: ${medicine.days_since_last_sale || 'N/A'}

**Recent Sales History (last 90 days):**
${salesHistory.length > 0 ? salesHistory.map(s => `${s.sale_date}: ${s.total_quantity} units sold`).join('\n') : 'No sales history available'}

**Expiry Dates of Current Stock:**
${medicine.expiry_dates?.length > 0 ? medicine.expiry_dates.join(', ') : 'No batches in stock'}

**Context:**
- Today is ${dayOfWeek}, ${today.toLocaleDateString('en-IN')} (${month})
- Location: Taliparamba, Kannur, Kerala
- Forecast horizon: ${forecastHorizon} days

**Task:**
Based on the data above, provide a ${predictionType} analysis for the next ${forecastHorizon} days.

**Consider:**
1. Day-of-week patterns (weekends vs weekdays)
2. Seasonal factors (monsoon, summer, festival seasons in Kerala)
3. Recent sales trends (rising, stable, declining)
4. Current stock levels vs consumption rate
5. Expiry risk
6. For Kerala context: Common diseases during this season

**Respond ONLY with a valid JSON object (no markdown, no explanation) in this exact format:**
{
  "predicted_demand": <number of units expected to be sold in next ${forecastHorizon} days>,
  "confidence_score": <0.0 to 1.0>,
  "stockout_risk_score": <0 to 100, where 100 is certain stockout>,
  "dead_stock_risk_score": <0 to 100, where 100 is certain dead stock>,
  "reasoning": "<2-3 sentence explanation of your prediction>",
  "contributing_factors": {
    "seasonal": <true/false>,
    "trending": <"up"/"stable"/"down">,
    "day_of_week_impact": <"high"/"medium"/"low">,
    "expiry_risk": <true/false>
  },
  "recommended_action": "<ORDER_NOW/ORDER_SOON/REDUCE_STOCK/MONITOR/DISCONTINUE>",
  "recommended_quantity": <integer, suggested order quantity, or null>
}`;
  }

  async getRecentPredictions(tenantId: string, limit: number = 10) {
    return await this.dataSource.query(
      `SELECT 
        p.*,
        m.brand_name as medicine_name,
        m.molecule as generic_name
      FROM ai_stock_predictions p
      JOIN medicines m ON p.medicine_id = m.id
      WHERE p.tenant_id = $1
      ORDER BY p.prediction_date DESC
      LIMIT $2`,
      [tenantId, limit]
    );
  }

  async getMedicinePredictionHistory(tenantId: string, medicineId: string) {
    return await this.dataSource.query(
      `SELECT * FROM ai_stock_predictions 
       WHERE tenant_id = $1 AND medicine_id = $2
       ORDER BY prediction_date DESC`,
      [tenantId, medicineId]
    );
  }
}
