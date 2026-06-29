import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class PendingReceptionService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async routeToReception(dto: {
    patient_name?: string;
    patient_id?: string;
    doctor_name?: string;
    referring_doctor?: string;
    cart_data: any[];
    compliance_data?: any;
    subtotal: number;
    total_amount: number;
    discount_amount: number;
    tax_amount: number;
  }, userId: string, tenantId: string) {
    const [row] = await this.db.query(
      `INSERT INTO pending_reception_bills
         (tenant_id, patient_name, patient_id, doctor_name, referring_doctor,
          cart_data, compliance_data, subtotal, total_amount,
          discount_amount, tax_amount, routed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, patient_name, total_amount, created_at`,
      [
        tenantId,
        dto.patient_name || null,
        dto.patient_id || null,
        dto.doctor_name || null,
        dto.referring_doctor || null,
        JSON.stringify(dto.cart_data),
        dto.compliance_data ? JSON.stringify(dto.compliance_data) : null,
        dto.subtotal,
        dto.total_amount,
        dto.discount_amount,
        dto.tax_amount,
        userId,
      ],
    );
    return row;
  }

  async getPending(tenantId: string) {
    return this.db.query(
      `SELECT id, patient_name, doctor_name, referring_doctor,
              cart_data, subtotal, total_amount, discount_amount,
              tax_amount, created_at
       FROM pending_reception_bills
       WHERE tenant_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [tenantId],
    );
  }

  async collectPayment(id: string, paymentMode: string, userId: string, tenantId: string) {
    const [pending] = await this.db.query(
      `SELECT * FROM pending_reception_bills
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId],
    );
    if (!pending) throw new NotFoundException('Pending bill not found');

    await this.db.query(
      `UPDATE pending_reception_bills
       SET status = 'collected', payment_mode = $1,
           collected_by = $2, updated_at = NOW()
       WHERE id = $3`,
      [paymentMode, userId, id],
    );

    return {
      pending_id: id,
      cart_data: pending.cart_data,
      compliance_data: pending.compliance_data,
      patient_name: pending.patient_name,
      patient_id: pending.patient_id,
      doctor_name: pending.doctor_name,
      referring_doctor: pending.referring_doctor,
      total_amount: pending.total_amount,
      discount_amount: pending.discount_amount,
      payment_mode: paymentMode,
    };
  }

  async cancel(id: string, tenantId: string) {
    await this.db.query(
      `UPDATE pending_reception_bills
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId],
    );
    return { cancelled: true };
  }
}
