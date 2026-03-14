import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ClinicBill, ClinicBillItem, BillStatus, BillPaymentMode, BillLineSource } from './clinic-bill.entity';
import { VipTierConfig, VipTier } from './vip-tier.entity';
import { DoctorRateConfig } from './doctor-rate-config.entity';
import { ServiceRate, ServiceCategory } from './service-rate.entity';

const n = (v: any) => Number(v) || 0;

interface LineItemDto {
  category: ServiceCategory;
  name: string;
  qty: number;
  unit_rate: number;
  gst_percent?: number;
  source?: BillLineSource;
  source_id?: string;
}

interface CreateBillDto {
  patient_id: string;
  queue_id?: string;
  items: LineItemDto[];
  payment_mode?: BillPaymentMode;
  extra_discount_pct?: number;
  extra_discount_amt?: number;
  extra_discount_note?: string;
  notes?: string;
}

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(ClinicBill)
    private billRepo: Repository<ClinicBill>,
    @InjectRepository(ClinicBillItem)
    private itemRepo: Repository<ClinicBillItem>,
    @InjectRepository(VipTierConfig)
    private vipRepo: Repository<VipTierConfig>,
    @InjectRepository(DoctorRateConfig)
    private doctorRateRepo: Repository<DoctorRateConfig>,
    @InjectRepository(ServiceRate)
    private serviceRateRepo: Repository<ServiceRate>,
    private dataSource: DataSource,
  ) {}

  // ── Generate sequential bill number ─────────────────────────
  private async nextBillNumber(tenantId: string): Promise<string> {
    const count = await this.billRepo.count({ where: { tenant_id: tenantId } });
    return `BL-${String(count + 1).padStart(5, '0')}`;
  }

  // ── Get VIP discounts for a patient ─────────────────────────
  async getVipDiscounts(tenantId: string, patientId: string): Promise<{
    tier: VipTier | null;
    doctor_discount: number;
    pharmacy_discount: number;
    lab_discount: number;
  }> {
    const result = await this.dataSource.query(
      `SELECT vip_tier, vip_valid_until FROM patients WHERE id = $1 AND tenant_id = $2`,
      [patientId, tenantId],
    );
    const patient = result[0];
    if (!patient?.vip_tier) {
      return { tier: null, doctor_discount: 0, pharmacy_discount: 0, lab_discount: 0 };
    }
    // Check if VIP is still valid
    if (patient.vip_valid_until && new Date(patient.vip_valid_until) < new Date()) {
      return { tier: null, doctor_discount: 0, pharmacy_discount: 0, lab_discount: 0 };
    }
    const tierConfig = await this.vipRepo.findOne({
      where: { tenant_id: tenantId, tier: patient.vip_tier, is_active: true },
    });
    if (!tierConfig) {
      return { tier: null, doctor_discount: 0, pharmacy_discount: 0, lab_discount: 0 };
    }
    return {
      tier: patient.vip_tier,
      doctor_discount:   n(tierConfig.doctor_discount),
      pharmacy_discount: n(tierConfig.pharmacy_discount),
      lab_discount:      n(tierConfig.lab_discount),
    };
  }

  // ── Calculate bill totals ────────────────────────────────────
  async calculateBill(tenantId: string, patientId: string, items: LineItemDto[], extraDiscountPct = 0, extraDiscountAmt = 0) {
    const vip = await this.getVipDiscounts(tenantId, patientId);

    let subtotal = 0;
    let gstAmount = 0;
    let vipDiscountAmount = 0;

    const computed = items.map(item => {
      const qty       = Math.max(1, item.qty);
      const unitRate  = n(item.unit_rate);
      const gstPct    = n(item.gst_percent);
      const lineBase  = unitRate * qty;
      const lineGst   = (lineBase * gstPct) / 100;
      const lineTotal = lineBase + lineGst;

      // VIP discount per category
      let vipPct = 0;
      if (vip.tier) {
        if (item.category === ServiceCategory.CONSULTATION) {
          vipPct = vip.doctor_discount;
        } else if (item.category === ServiceCategory.PHARMACY) {
          vipPct = vip.pharmacy_discount;
        } else if (item.category === ServiceCategory.LAB) {
          vipPct = vip.lab_discount;
        }
      }
      const vipDisc = (lineBase * vipPct) / 100;

      subtotal         += lineBase;
      gstAmount        += lineGst;
      vipDiscountAmount += vipDisc;

      return { ...item, qty, unit_rate: unitRate, gst_percent: gstPct, line_total: lineTotal, vip_discount: vipDisc };
    });

    const extraDiscPct = Math.max(0, Math.min(100, extraDiscountPct));
    const extraDiscFlat = Math.max(0, extraDiscountAmt);
    const extraDiscFromPct = ((subtotal + gstAmount - vipDiscountAmount) * extraDiscPct) / 100;
    const totalExtraDisc = extraDiscFlat > 0 ? extraDiscFlat : extraDiscFromPct;

    const total = Math.max(0, subtotal + gstAmount - vipDiscountAmount - totalExtraDisc);

    return {
      items: computed,
      subtotal,
      gst_amount: gstAmount,
      vip_discount_amount: vipDiscountAmount,
      vip_tier: vip.tier,
      extra_discount_amt: totalExtraDisc,
      extra_discount_pct: extraDiscPct,
      total_amount: total,
    };
  }

  // ── Create bill ──────────────────────────────────────────────
  async createBill(dto: CreateBillDto, tenantId: string, userId: string) {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const calc = await this.calculateBill(
        tenantId, dto.patient_id, dto.items,
        dto.extra_discount_pct, dto.extra_discount_amt,
      );

      const billNumber = await this.nextBillNumber(tenantId);

      const bill = qr.manager.create(ClinicBill, {
        tenant_id:           tenantId,
        bill_number:         billNumber,
        patient_id:          dto.patient_id,
        queue_id:            dto.queue_id,
        subtotal:            calc.subtotal,
        gst_amount:          calc.gst_amount,
        vip_discount_amount: calc.vip_discount_amount,
        extra_discount_amt:  calc.extra_discount_amt,
        extra_discount_pct:  calc.extra_discount_pct,
        extra_discount_note: dto.extra_discount_note,
        total_amount:        calc.total_amount,
        payment_mode:        dto.payment_mode ?? BillPaymentMode.CASH,
        status:              BillStatus.CONFIRMED,
        notes:               dto.notes,
        created_by:          userId,
      });
      const savedBill = await qr.manager.save(ClinicBill, bill);

      const lineItems = calc.items.map(item =>
        qr.manager.create(ClinicBillItem, {
          tenant_id:   tenantId,
          bill_id:     savedBill.id,
          category:    item.category,
          name:        item.name,
          qty:         item.qty,
          unit_rate:   item.unit_rate,
          gst_percent: item.gst_percent,
          line_total:  item.line_total,
          source:      item.source ?? BillLineSource.MANUAL,
          source_id:   item.source_id,
        })
      );
      await qr.manager.save(ClinicBillItem, lineItems);

      await qr.commitTransaction();
      return { ...savedBill, items: lineItems, vip_tier: calc.vip_tier };
    } catch (err) {
      await qr.rollbackTransaction();
      throw err;
    } finally {
      await qr.release();
    }
  }

  // ── Get bill by id ───────────────────────────────────────────
  async getBill(id: string, tenantId: string) {
    const bill = await this.billRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!bill) throw new NotFoundException('Bill not found');
    const items = await this.itemRepo.find({ where: { bill_id: id } });
    return { ...bill, items };
  }

  // ── List bills ───────────────────────────────────────────────
  async listBills(tenantId: string, filters: {
    date?: string; patientId?: string; status?: string; page?: number; limit?: number;
  }) {
    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 50;
    const qb = this.billRepo.createQueryBuilder('b')
      .where('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (filters.date)      qb.andWhere('DATE(b.created_at) = :date', { date: filters.date });
    if (filters.patientId) qb.andWhere('b.patient_id = :pid', { pid: filters.patientId });
    if (filters.status)    qb.andWhere('b.status = :status', { status: filters.status });
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  // ── VIP tier CRUD ────────────────────────────────────────────
  async getVipTiers(tenantId: string) {
    return this.vipRepo.find({
      where: { tenant_id: tenantId },
      order: { tier: 'ASC' },
    });
  }

  async updateVipTier(tenantId: string, tier: VipTier, dto: Partial<VipTierConfig>) {
    const existing = await this.vipRepo.findOne({ where: { tenant_id: tenantId, tier } });
    if (!existing) throw new NotFoundException('VIP tier not found');
    Object.assign(existing, {
      label:             dto.label             ?? existing.label,
      annual_fee:        dto.annual_fee        ?? existing.annual_fee,
      doctor_discount:   dto.doctor_discount   ?? existing.doctor_discount,
      pharmacy_discount: dto.pharmacy_discount ?? existing.pharmacy_discount,
      lab_discount:      dto.lab_discount      ?? existing.lab_discount,
      is_active:         dto.is_active         ?? existing.is_active,
    });
    return this.vipRepo.save(existing);
  }

  // ── Doctor rate config ───────────────────────────────────────
  async getDoctorRates(tenantId: string) {
    const rates = await this.doctorRateRepo.find({ where: { tenant_id: tenantId } });
    // Enrich with doctor names
    const doctorIds = rates.map(r => r.doctor_id);
    if (doctorIds.length === 0) return [];
    const doctors = await this.dataSource.query(
      `SELECT id, full_name, specialization FROM users WHERE id = ANY($1) AND tenant_id = $2`,
      [doctorIds, tenantId],
    );
    const docMap = Object.fromEntries(doctors.map((d: any) => [d.id, d]));
    return rates.map(r => ({ ...r, doctor: docMap[r.doctor_id] ?? null }));
  }

  async upsertDoctorRate(tenantId: string, doctorId: string, dto: Partial<DoctorRateConfig>) {
    let config = await this.doctorRateRepo.findOne({
      where: { tenant_id: tenantId, doctor_id: doctorId },
    });
    if (!config) {
      config = this.doctorRateRepo.create({ tenant_id: tenantId, doctor_id: doctorId });
    }
    Object.assign(config, {
      new_visit_rate:          dto.new_visit_rate          ?? config.new_visit_rate,
      follow_up_rate:          dto.follow_up_rate          ?? config.follow_up_rate,
      emergency_rate:          dto.emergency_rate          ?? config.emergency_rate,
      vip_discount_applicable: dto.vip_discount_applicable ?? config.vip_discount_applicable,
    });
    return this.doctorRateRepo.save(config);
  }

  async getDoctorRateForPatient(tenantId: string, doctorId: string, patientId: string, visitType: string) {
    const config = await this.doctorRateRepo.findOne({
      where: { tenant_id: tenantId, doctor_id: doctorId },
    });
    const rates = config ?? { new_visit_rate: 300, follow_up_rate: 150, emergency_rate: 500, vip_discount_applicable: true };

    let baseRate = n(rates.new_visit_rate);
    if (visitType === 'follow_up') baseRate = n(rates.follow_up_rate);
    if (visitType === 'emergency') baseRate = n(rates.emergency_rate);

    // Apply VIP only if doctor has opted in
    let vipDiscount = 0;
    if (rates.vip_discount_applicable) {
      const vip = await this.getVipDiscounts(tenantId, patientId);
      vipDiscount = (baseRate * vip.doctor_discount) / 100;
    }

    return {
      base_rate:    baseRate,
      vip_discount: vipDiscount,
      final_rate:   Math.max(0, baseRate - vipDiscount),
      vip_applicable: rates.vip_discount_applicable,
    };
  }

  // ── Service rates CRUD ───────────────────────────────────────
  async getServiceRates(tenantId: string, category?: ServiceCategory) {
    const where: any = { tenant_id: tenantId, is_active: true };
    if (category) where.category = category;
    return this.serviceRateRepo.find({ where, order: { category: 'ASC', sort_order: 'ASC' } });
  }

  async upsertServiceRate(tenantId: string, id: string | undefined, dto: Partial<ServiceRate>) {
    let rate: ServiceRate;
    if (id) {
      rate = await this.serviceRateRepo.findOne({ where: { id, tenant_id: tenantId } });
      if (!rate) throw new NotFoundException('Service rate not found');
    } else {
      rate = this.serviceRateRepo.create({ tenant_id: tenantId });
    }
    Object.assign(rate, dto);
    return this.serviceRateRepo.save(rate);
  }

  async deleteServiceRate(tenantId: string, id: string) {
    const rate = await this.serviceRateRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!rate) throw new NotFoundException('Service rate not found');
    rate.is_active = false;
    return this.serviceRateRepo.save(rate);
  }

  // ── Preview bill before confirming ──────────────────────────
  async previewBill(tenantId: string, patientId: string, items: LineItemDto[], extraDiscountPct = 0, extraDiscountAmt = 0) {
    return this.calculateBill(tenantId, patientId, items, extraDiscountPct, extraDiscountAmt);
  }
}
