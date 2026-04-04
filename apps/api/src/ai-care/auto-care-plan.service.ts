// auto-care-plan.service.ts - FIXED VERSION
// Uses correct medication_plans schema columns
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface SaleItemInput {
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

  async createPlansFromSale(
    saleId: string,
    tenantId: string,
    patientId: string | null,
    patientName: string,
    patientMobile: string,
    doctorName: string,
    items: SaleItemInput[],
  ): Promise<void> {
    try {
      const planItems = items.filter(i => i.create_care_plan === true || i.is_chronic === true);
      if (!planItems.length) return;

      for (const item of planItems) {
        try {
          if (patientId) {
            const existing = await this.ds.query(
              `SELECT id FROM medication_plans WHERE tenant_id=$1 AND patient_id=$2
               AND medicine_name ILIKE $3 AND status IN ('active','pending') LIMIT 1`,
              [tenantId, patientId, item.medicine_name]
            );
            if (existing.length > 0) {
              const days = this.estimateDaysSupply(item.qty, item.medicine_name);
              const reminder = new Date();
              reminder.setDate(reminder.getDate() + Math.max(days - 5, Math.floor(days * 0.8)));
              await this.ds.query(
                `UPDATE medication_plans SET refill_reminder_date=$1, next_refill_date=CURRENT_DATE+$2,
                 last_dispensed_date=CURRENT_DATE, updated_at=NOW() WHERE id=$3`,
                [reminder.toISOString().split('T')[0], days, existing[0].id]
              );
              continue;
            }
          }

          const days = this.estimateDaysSupply(item.qty, item.medicine_name);
          const endDate = new Date(); endDate.setDate(endDate.getDate() + days);
          const reminder = new Date(); reminder.setDate(reminder.getDate() + Math.max(days - 5, Math.floor(days * 0.8)));
          const rd = reminder.toISOString().split('T')[0];
          const ed = endDate.toISOString().split('T')[0];

          await this.ds.query(
            `INSERT INTO medication_plans (tenant_id,patient_id,patient_name,patient_mobile,
               medicine_id,medicine_name,sale_id,dosage,frequency,frequency_per_day,
               start_date,end_date,duration_days,refill_reminder_date,next_refill_date,
               last_dispensed_date,chronic_category,source,status,created_at,updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_DATE,$11,$12,$13,$14,
               CURRENT_DATE,$15,$16,'active',NOW(),NOW()) ON CONFLICT DO NOTHING`,
            [tenantId,patientId,patientName||'Walk-in','',
             item.medicine_id,item.medicine_name,saleId,
             this.inferDosage(item.medicine_name),this.inferFrequency(item.medicine_name,item.qty),
             this.inferFrequencyPerDay(item.medicine_name,item.qty),
             ed,days,rd,rd,item.chronic_category||'Chronic','billing_auto']
          );
          this.logger.log(`Care plan created: ${item.medicine_name} (${days}d)`);
        } catch (err: any) {
          this.logger.warn(`Plan failed for ${item.medicine_name}: ${err.message}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Auto care plan error: ${err.message}`);
    }
  }

  private estimateDaysSupply(qty: number, name: string): number {
    const n = name.toUpperCase();
    if (n.includes('INH') || n.includes('ROTACAP')) return 30;
    if (n.startsWith('INJ')) return 7;
    if (n.startsWith('SYP') || n.startsWith('SYR')) return 14;
    if (qty >= 90) return 30; if (qty >= 60) return 30;
    if (qty >= 30) return 30; if (qty >= 20) return 20;
    if (qty >= 14) return 14; if (qty >= 10) return 10;
    return 7;
  }

  private inferFrequency(name: string, qty: number): string {
    const n = name.toUpperCase();
    if (n.includes('TDS') || qty >= 90) return 'Thrice daily';
    if (n.includes('BD') || qty >= 60) return 'Twice daily';
    return 'Once daily';
  }

  private inferFrequencyPerDay(name: string, qty: number): number {
    if (name.toUpperCase().includes('TDS') || qty >= 90) return 3;
    if (name.toUpperCase().includes('BD') || qty >= 60) return 2;
    return 1;
  }

  private inferDosage(name: string): string {
    const m = name.match(/(\d+\.?\d*\s*(mg|mcg|ml|g|iu|units?))/i);
    return m ? m[0] : 'As prescribed';
  }
}
