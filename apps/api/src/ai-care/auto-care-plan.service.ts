// auto-care-plan.service.ts
// Place at: apps/api/src/ai-care/auto-care-plan.service.ts
//
// Called after every successful sale to auto-create AI Care medication plans
// for chronic medicines based on 3-signal detection.

import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface SaleItem {
  medicine_id: string;
  medicine_name: string;
  qty: number;
  create_care_plan?: boolean;
  is_chronic?: boolean;
  chronic_category?: string;
}

@Injectable()
export class AutoCarePlanService {
  private readonly logger = new Logger(AutoCarePlanService.name);

  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Called after every successful sale ────────────────────────────────────
  async createPlansFromSale(
    saleId: string,
    tenantId: string,
    patientId: string | null,
    patientName: string,
    doctorName: string,
    items: SaleItem[],
  ): Promise<void> {
    try {
      // Filter items that should create care plans
      const planItems = items.filter(item => {
        // Signal 4: Doctor/pharmacist explicitly flagged at billing
        if (item.create_care_plan === true) return true;
        // Already false — skip
        if (item.create_care_plan === false) return false;
        // Signal 1 + 2: is_chronic from medicine master
        if (item.is_chronic === true) return true;
        return false;
      });

      if (planItems.length === 0) return;

      // Get or create patient record for this sale
      let patId = patientId;
      if (!patId && patientName) {
        // Try to find patient by name
        const found = await this.ds.query(
          `SELECT id FROM patients WHERE tenant_id=$1 AND first_name ILIKE $2 AND is_active=true LIMIT 1`,
          [tenantId, patientName.split(' ')[0]]
        );
        patId = found[0]?.id || null;
      }

      for (const item of planItems) {
        try {
          // Check if a plan already exists for this patient + medicine (avoid duplicates)
          if (patId) {
            const existing = await this.ds.query(
              `SELECT id FROM medication_plans
               WHERE tenant_id=$1 AND patient_id=$2 AND medicine_name ILIKE $3
               AND status IN ('active','pending') LIMIT 1`,
              [tenantId, patId, item.medicine_name]
            );
            if (existing.length > 0) {
              // Update refill date instead of creating duplicate
              const daysSupply = this.estimateDaysSupply(item.qty, item.medicine_name);
              await this.ds.query(
                `UPDATE medication_plans
                 SET next_refill_date = CURRENT_DATE + $1,
                     last_dispensed_date = CURRENT_DATE,
                     last_sale_id = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [daysSupply, saleId, existing[0].id]
              );
              this.logger.log(`Updated refill for ${item.medicine_name} — next refill in ${daysSupply} days`);
              continue;
            }
          }

          // Estimate days supply from quantity
          const daysSupply = this.estimateDaysSupply(item.qty, item.medicine_name);
          const refillDate = new Date();
          refillDate.setDate(refillDate.getDate() + Math.max(daysSupply - 5, daysSupply * 0.8 | 0));

          // Create new medication plan
          await this.ds.query(
            `INSERT INTO medication_plans
             (tenant_id, patient_id, patient_name, medicine_name, medicine_id,
              dosage, frequency, duration_days, start_date, next_refill_date,
              last_dispensed_date, last_sale_id, doctor_name, chronic_category,
              source, status, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$9,CURRENT_DATE,$10,$11,$12,$13,'active',NOW(),NOW())
             ON CONFLICT DO NOTHING`,
            [
              tenantId,
              patId,
              patientName || 'Walk-in',
              item.medicine_name,
              item.medicine_id,
              this.inferDosage(item.medicine_name),
              this.inferFrequency(item.medicine_name, item.qty),
              daysSupply,
              refillDate.toISOString().split('T')[0],
              saleId,
              doctorName || '',
              item.chronic_category || 'Chronic',
              'billing_auto',
            ]
          );

          this.logger.log(`Auto-created care plan for ${item.medicine_name} — refill in ${daysSupply} days`);
        } catch (err) {
          // Don't fail the whole sale if plan creation fails
          this.logger.warn(`Failed to create plan for ${item.medicine_name}: ${err.message}`);
        }
      }
    } catch (err) {
      this.logger.warn(`Auto care plan creation failed for sale ${saleId}: ${err.message}`);
    }
  }

  // ── Estimate days supply from quantity dispensed ──────────────────────────
  private estimateDaysSupply(qty: number, medicineName: string): number {
    const name = medicineName.toUpperCase();

    // Inhalers — fixed 30 days
    if (name.includes('INH') || name.includes('ROTACAP') || name.includes('TURBUHALER')) return 30;

    // Injections — acute, 7 days
    if (name.startsWith('INJ') || name.includes('INJECTION')) return 7;

    // Syrups/liquids — estimate 10-14 days
    if (name.startsWith('SYP') || name.startsWith('SYR') || name.includes('SYRUP')) {
      return qty <= 1 ? 14 : 7;
    }

    // Sachets
    if (name.includes('SACHET')) return qty;

    // Tablets/Capsules — infer from quantity
    // Common dosing patterns:
    if (qty >= 90) return 30;  // TDS (3x daily) × 30 days
    if (qty >= 60) return 30;  // BD (2x daily) × 30 days
    if (qty >= 30) return 30;  // OD (once daily) × 30 days
    if (qty >= 20) return 20;
    if (qty >= 14) return 14;
    if (qty >= 10) return 10;
    return 7;
  }

  // ── Infer frequency from medicine name and quantity ───────────────────────
  private inferFrequency(medicineName: string, qty: number): string {
    const name = medicineName.toUpperCase();
    if (name.includes('BD') || name.includes('TWICE')) return 'Twice daily';
    if (name.includes('TDS') || name.includes('THRICE')) return 'Thrice daily';
    if (name.includes('OD') || name.includes('ONCE')) return 'Once daily';
    // Infer from quantity if 30-day supply assumed
    if (qty >= 90) return 'Thrice daily';
    if (qty >= 60) return 'Twice daily';
    return 'Once daily';
  }

  // ── Infer dosage from medicine name ──────────────────────────────────────
  private inferDosage(medicineName: string): string {
    // Extract mg/ml/mcg from name
    const match = medicineName.match(/(\d+\.?\d*\s*(mg|mcg|ml|g|iu|units?))/i);
    return match ? match[0] : 'As prescribed';
  }
}
