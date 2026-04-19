import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EncounterService, EncounterServiceStatus } from './encounter-service.entity';

@Injectable()
export class EncounterServicesService {
  constructor(
    @InjectRepository(EncounterService)
    private repo: Repository<EncounterService>,
    private dataSource: DataSource,
  ) {}

  // ── Order a service for a queue entry ─────────────────────────────────────
  async orderService(tenantId: string, dto: {
    queue_id: string;
    service_rate_id?: string;
    name: string;
    category: string;
    price: number;
    gst_percent?: number;
    notify_role?: string;
    notes?: string;
    ordered_by_role?: string;
    ordered_by?: string;
  }): Promise<EncounterService> {
    const svc = this.repo.create({
      tenant_id:       tenantId,
      queue_id:        dto.queue_id,
      service_rate_id: dto.service_rate_id,
      name:            dto.name,
      category:        dto.category,
      price:           dto.price,
      gst_percent:     dto.gst_percent ?? 0,
      notify_role:     dto.notify_role,
      notes:           dto.notes,
      ordered_by_role: dto.ordered_by_role ?? 'doctor',
      ordered_by:      dto.ordered_by,
      status:          EncounterServiceStatus.ORDERED,
    });
    return this.repo.save(svc);
  }

  // ── Get all services for a queue entry ────────────────────────────────────
  async getByQueue(queueId: string, tenantId: string): Promise<EncounterService[]> {
    return this.repo.find({
      where: { queue_id: queueId, tenant_id: tenantId },
      order: { ordered_at: 'ASC' },
    });
  }

  // ── Update service status (nurse/lab marks complete) ──────────────────────
  async updateStatus(id: string, tenantId: string, status: EncounterServiceStatus, userId: string, notes?: string): Promise<EncounterService> {
    const svc = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!svc) throw new NotFoundException('Service not found');
    svc.status = status;
    if (status === EncounterServiceStatus.COMPLETED) {
      svc.completed_by = userId;
      svc.completed_at = new Date();
    }
    if (notes) svc.notes = notes;
    return this.repo.save(svc);
  }

  // ── Delete/cancel a service ────────────────────────────────────────────────
  async cancel(id: string, tenantId: string): Promise<EncounterService> {
    const svc = await this.repo.findOne({ where: { id, tenant_id: tenantId } });
    if (!svc) throw new NotFoundException('Service not found');
    svc.status = EncounterServiceStatus.CANCELLED;
    return this.repo.save(svc);
  }

  // ── Get today's pending services by role (for nurse/lab dashboards) ────────
  async getPendingByRole(tenantId: string, role: string): Promise<any[]> {
    return this.dataSource.query(`
      SELECT es.*, q.token_number,
        p.first_name || ' ' || COALESCE(p.last_name,'') AS patient_name,
        u.full_name AS ordered_by_name
      FROM encounter_services es
      JOIN queues q ON q.id = es.queue_id
      JOIN patients p ON p.id = q.patient_id
      LEFT JOIN users u ON u.id = es.ordered_by
      WHERE es.tenant_id = $1
        AND es.notify_role = $2
        AND es.status IN ('ordered','in_progress')
        AND DATE(es.ordered_at) = CURRENT_DATE
      ORDER BY es.ordered_at ASC
    `, [tenantId, role]);
  }

  // ── Get encounter summary for receptionist (consolidated bill view) ────────
  async getEncounterSummary(queueId: string, tenantId: string): Promise<any> {
    const [queueRows, services, consultBills, pharmBills] = await Promise.all([
      // Queue + patient info
      this.dataSource.query(`
        SELECT q.id, q.token_number, q.status, q.visit_type, q.chief_complaint,
          q.consultation_fee, q.fee_paid, q.fee_payment_mode,
          p.first_name || ' ' || COALESCE(p.last_name,'') AS patient_name,
          p.id AS patient_id, u.full_name AS doctor_name
        FROM queues q
        JOIN patients p ON p.id = q.patient_id
        LEFT JOIN users u ON u.id = q.doctor_id
        WHERE q.id = $1 AND q.tenant_id = $2
      `, [queueId, tenantId]),

      // Encounter services
      this.repo.find({ where: { queue_id: queueId, tenant_id: tenantId }, order: { ordered_at: 'ASC' } }),

      // Consultation bills
      this.dataSource.query(`
        SELECT * FROM consultation_bills WHERE queue_id = $1 AND tenant_id = $2
      `, [queueId, tenantId]),

      // Pharmacy/medicine bills
      this.dataSource.query(`
        SELECT s.id, s.bill_number, s.total_amount, s.payment_mode, s.created_at
        FROM sales s
        JOIN prescriptions pr ON pr.sale_id = s.id
        JOIN consultations c ON c.id = pr.consultation_id
        WHERE c.queue_id = $1 AND s.tenant_id = $2
      `, [queueId, tenantId]),
    ]);

    const queue = queueRows[0];
    if (!queue) throw new NotFoundException('Queue entry not found');

    // Calculate totals
    const consultFee = Number(queue.consultation_fee || 0);
    const serviceTotal = services
      .filter(s => s.status !== 'cancelled')
      .reduce((sum, s) => sum + Number(s.price) + (Number(s.price) * Number(s.gst_percent) / 100), 0);
    const pharmTotal = pharmBills.reduce((sum: number, b: any) => sum + Number(b.total_amount), 0);
    const grandTotal = consultFee + serviceTotal;

    return {
      queue,
      services,
      consultation_bills: consultBills,
      pharmacy_bills: pharmBills,
      summary: {
        consultation_fee:  consultFee,
        services_total:    Math.round(serviceTotal * 100) / 100,
        pharmacy_total:    Math.round(pharmTotal * 100) / 100,
        clinic_total:      Math.round(grandTotal * 100) / 100,
        grand_total:       Math.round((grandTotal + pharmTotal) * 100) / 100,
        fee_paid:          queue.fee_paid,
      },
    };
  }

  // ── Today's encounter summary list (for receptionist dashboard) ────────────
  async getTodayEncounters(tenantId: string): Promise<any[]> {
    return this.dataSource.query(`
      SELECT
        q.id AS queue_id, q.token_number, q.status, q.fee_paid,
        q.consultation_fee,
        p.first_name || ' ' || COALESCE(p.last_name,'') AS patient_name,
        u.full_name AS doctor_name,
        COALESCE(
          (SELECT SUM(price + price * gst_percent / 100)
           FROM encounter_services es
           WHERE es.queue_id = q.id AND es.status != 'cancelled'), 0
        ) AS services_total,
        COALESCE(
          (SELECT SUM(s.total_amount)
           FROM sales s
           JOIN prescriptions pr ON pr.sale_id = s.id
           JOIN consultations c ON c.id = pr.consultation_id
           WHERE c.queue_id = q.id), 0
        ) AS pharmacy_total,
        (SELECT COUNT(*) FROM encounter_services es
         WHERE es.queue_id = q.id AND es.status = 'ordered') AS pending_services
      FROM queues q
      JOIN patients p ON p.id = q.patient_id
      LEFT JOIN users u ON u.id = q.doctor_id
      WHERE q.tenant_id = $1
        AND q.visit_date = CURRENT_DATE
        AND q.is_active = true
      ORDER BY q.token_number ASC
    `, [tenantId]);
  }
}
