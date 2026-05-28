import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { DispenseExpiryRule, DrugCategory } from './dispense-expiry-rule.entity';
import { DispenseAuditLog, DispenseValidationStatus } from './dispense-audit-log.entity';

// ─── Types ───────────────────────────────────────────────────────────

export interface ValidationResult {
  status: 'ALLOW' | 'WARN' | 'BLOCK';
  days_to_expiry: number;
  message: string;
  hard_stop_days: number;
  warning_days: number;
  safety_buffer_days: number;
}

export interface ValidateDispenseDto {
  medicine_id: string;
  batch_id: string;
  qty: number;
  course_days?: number;
}

export interface DispenseItemDto {
  medicine_id: string;
  batch_id: string;
  qty: number;
  course_days?: number;
  override_flag?: boolean;
  override_reason?: string;
}

export interface BatchInfo {
  id: string;
  batch_number: string;
  expiry_date: Date;
  quantity: number;
  sale_rate: number;
}

export interface MedicineInfo {
  id: string;
  brand_name: string;
  drug_category: DrugCategory;
  default_course_days: number;
}

// ─── Default rules (fallback if no DB rules exist) ───────────────────

const DEFAULT_RULES: Record<string, { hard_stop_days: number; warning_days: number; safety_buffer_days: number }> = {
  ACUTE:     { hard_stop_days: 15,  warning_days: 30,  safety_buffer_days: 5  },
  CHRONIC:   { hard_stop_days: 60,  warning_days: 120, safety_buffer_days: 15 },
  HIGH_RISK: { hard_stop_days: 90,  warning_days: 180, safety_buffer_days: 30 },
};

// ─── Service ─────────────────────────────────────────────────────────

@Injectable()
export class DispensingService {
  constructor(
    @InjectRepository(DispenseExpiryRule)
    private readonly rulesRepo: Repository<DispenseExpiryRule>,
    @InjectRepository(DispenseAuditLog)
    private readonly auditRepo: Repository<DispenseAuditLog>,
    private readonly dataSource: DataSource,
  ) {}

  // ── GET /dispensing/rules ─────────────────────────────────────────
  async getRules(tenantId: string): Promise<DispenseExpiryRule[]> {
    return this.rulesRepo.find({
      where: { tenant_id: tenantId, is_active: true },
      order: { category: 'ASC' },
    });
  }

  // ── PUT /dispensing/rules/:category ───────────────────────────────
  async updateRule(
    tenantId: string,
    category: DrugCategory,
    data: { hard_stop_days?: number; warning_days?: number; safety_buffer_days?: number },
  ): Promise<DispenseExpiryRule> {
    let rule = await this.rulesRepo.findOne({
      where: { tenant_id: tenantId, category },
    });

    if (!rule) {
      const defaults = DEFAULT_RULES[category] || DEFAULT_RULES.ACUTE;
      rule = this.rulesRepo.create({
        tenant_id: tenantId,
        category,
        ...defaults,
        ...data,
      });
    } else {
      Object.assign(rule, data);
    }

    return this.rulesRepo.save(rule);
  }

  // ── GET /dispensing/batches?medicine_id= ──────────────────────────
  // Returns FEFO-sorted batches with validation status per batch
  async getBatchesWithValidation(
    tenantId: string,
    medicineId: string,
    courseDays?: number,
  ) {
    // Get medicine info
    const medicine = await this.dataSource.query(
      `SELECT id, brand_name, drug_category, default_course_days
       FROM medicines WHERE id = $1 AND tenant_id = $2`,
      [medicineId, tenantId],
    );
    if (!medicine.length) throw new BadRequestException('Medicine not found');
    const med: MedicineInfo = medicine[0];

    // Get all in-stock batches sorted FEFO
    const batches: BatchInfo[] = await this.dataSource.query(
      `SELECT id, batch_number, expiry_date, quantity, sale_rate
       FROM stock_batches
       WHERE medicine_id = $1 AND tenant_id = $2 AND quantity > 0 AND is_active = true
       ORDER BY expiry_date ASC`,
      [medicineId, tenantId],
    );

    // Get rules for this category
    const rule = await this.getRuleForCategory(tenantId, med.drug_category);
    const effectiveCourseDays = courseDays || med.default_course_days || 5;

    // Validate each batch
    const results = batches.map(batch => {
      const validation = this.validateBatch(batch.expiry_date, effectiveCourseDays, rule);
      return {
        ...batch,
        validation,
        is_fefo_recommended: false,
      };
    });

    // Mark the first ALLOW or WARN batch as FEFO recommended
    const fefoIdx = results.findIndex(r => r.validation.status !== 'BLOCK');
    if (fefoIdx >= 0) results[fefoIdx].is_fefo_recommended = true;

    return {
      medicine: med,
      effective_course_days: effectiveCourseDays,
      rule,
      batches: results,
    };
  }

  // ── POST /dispensing/validate ─────────────────────────────────────
  async validateDispense(
    tenantId: string,
    dto: ValidateDispenseDto,
  ): Promise<ValidationResult & { medicine_name: string; batch_number: string }> {
    const medicine = await this.dataSource.query(
      `SELECT id, brand_name, drug_category, default_course_days
       FROM medicines WHERE id = $1 AND tenant_id = $2`,
      [dto.medicine_id, tenantId],
    );
    if (!medicine.length) throw new BadRequestException('Medicine not found');
    const med: MedicineInfo = medicine[0];

    const batches = await this.dataSource.query(
      `SELECT id, batch_number, expiry_date, quantity
       FROM stock_batches WHERE id = $1 AND tenant_id = $2`,
      [dto.batch_id, tenantId],
    );
    if (!batches.length) throw new BadRequestException('Batch not found');
    const batch = batches[0];

    if (batch.quantity < dto.qty) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${batch.quantity}, requested: ${dto.qty}`,
      );
    }

    const rule = await this.getRuleForCategory(tenantId, med.drug_category);
    const effectiveCourseDays = dto.course_days || med.default_course_days || 5;
    const validation = this.validateBatch(batch.expiry_date, effectiveCourseDays, rule);

    return {
      ...validation,
      medicine_name: med.brand_name,
      batch_number: batch.batch_number,
    };
  }

  // ── Enforce validation in sale flow ───────────────────────────────
  // Call this from sales.service.ts before deducting stock
  async enforceExpiryValidation(
    tenantId: string,
    item: DispenseItemDto,
    userId: string,
    userName: string,
    saleId?: string,
  ): Promise<void> {
    const medicine = await this.dataSource.query(
      `SELECT id, brand_name, drug_category, default_course_days
       FROM medicines WHERE id = $1 AND tenant_id = $2`,
      [item.medicine_id, tenantId],
    );
    if (!medicine.length) return; // skip if medicine not found (shouldn't happen)
    const med: MedicineInfo = medicine[0];

    const batches = await this.dataSource.query(
      `SELECT id, batch_number, expiry_date, quantity
       FROM stock_batches WHERE id = $1 AND tenant_id = $2`,
      [item.batch_id, tenantId],
    );
    if (!batches.length) return;
    const batch = batches[0];

    const rule = await this.getRuleForCategory(tenantId, med.drug_category);
    const effectiveCourseDays = item.course_days || med.default_course_days || 5;
    const validation = this.validateBatch(batch.expiry_date, effectiveCourseDays, rule);

    // Hard block: expired medicine cannot be dispensed, period
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(batch.expiry_date);
    expDate.setHours(0, 0, 0, 0);
    if (expDate < today) {
      throw new BadRequestException(
        `BLOCKED: ${med.brand_name} batch ${batch.batch_number} has expired (${batch.expiry_date}). Cannot dispense.`,
      );
    }

    // BLOCK without override → reject
    if (validation.status === 'BLOCK' && !item.override_flag) {
      throw new BadRequestException(
        `BLOCKED: ${validation.message}. Use override with a reason to proceed.`,
      );
    }

    // BLOCK with override but no reason → reject
    if (validation.status === 'BLOCK' && item.override_flag && !item.override_reason?.trim()) {
      throw new BadRequestException(
        'Override requires a reason. Please provide override_reason.',
      );
    }

    // Log WARN and BLOCK (overridden) to audit
    if (validation.status !== 'ALLOW') {
      await this.auditRepo.save({
        tenant_id: tenantId,
        sale_id: saleId || null,
        medicine_id: item.medicine_id,
        medicine_name: med.brand_name,
        batch_id: item.batch_id,
        batch_number: batch.batch_number,
        expiry_date: batch.expiry_date,
        days_to_expiry: validation.days_to_expiry,
        validation_status: validation.status as DispenseValidationStatus,
        validation_message: validation.message,
        override_flag: item.override_flag || false,
        override_reason: item.override_reason || null,
        course_days: effectiveCourseDays,
        qty_dispensed: item.qty,
        user_id: userId,
        user_name: userName,
      });
    }
  }

  // ── GET /dispensing/audit-log ──────────────────────────────────────
  async getAuditLog(
    tenantId: string,
    filters: { from?: string; to?: string; status?: string; medicine_id?: string },
    page = 1,
    limit = 50,
  ) {
    let query = `
      SELECT * FROM dispense_audit_log
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    let paramIdx = 2;

    if (filters.from) {
      query += ` AND dispensed_at >= $${paramIdx}`;
      params.push(filters.from);
      paramIdx++;
    }
    if (filters.to) {
      query += ` AND dispensed_at <= $${paramIdx}`;
      params.push(filters.to);
      paramIdx++;
    }
    if (filters.status) {
      query += ` AND validation_status = $${paramIdx}`;
      params.push(filters.status);
      paramIdx++;
    }
    if (filters.medicine_id) {
      query += ` AND medicine_id = $${paramIdx}`;
      params.push(filters.medicine_id);
      paramIdx++;
    }

    query += ` ORDER BY dispensed_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
    params.push(limit, (page - 1) * limit);

    const rows = await this.dataSource.query(query, params);

    const countQuery = `SELECT COUNT(*) FROM dispense_audit_log WHERE tenant_id = $1`;
    const total = await this.dataSource.query(countQuery, [tenantId]);

    return {
      data: rows,
      total: parseInt(total[0].count, 10),
      page,
      limit,
    };
  }

  // ── Private: get rule for category ─────────────────────────────────
  private async getRuleForCategory(
    tenantId: string,
    category: DrugCategory,
  ) {
    const rule = await this.rulesRepo.findOne({
      where: { tenant_id: tenantId, category, is_active: true },
    });

    if (rule) {
      return {
        hard_stop_days: rule.hard_stop_days,
        warning_days: rule.warning_days,
        safety_buffer_days: rule.safety_buffer_days,
      };
    }

    return DEFAULT_RULES[category] || DEFAULT_RULES.ACUTE;
  }

  // ── Private: core validation logic (pure function) ─────────────────
  private validateBatch(
    expiryDate: Date | string,
    courseDays: number,
    rule: { hard_stop_days: number; warning_days: number; safety_buffer_days: number },
  ): ValidationResult {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const daysToExpiry = Math.floor((exp.getTime() - today.getTime()) / 86400000);
    const requiredDays = courseDays + rule.safety_buffer_days;

    if (daysToExpiry < 0) {
      return {
        status: 'BLOCK',
        days_to_expiry: daysToExpiry,
        message: 'Medicine has expired',
        ...rule,
      };
    }

    if (daysToExpiry < rule.hard_stop_days) {
      return {
        status: 'BLOCK',
        days_to_expiry: daysToExpiry,
        message: `Only ${daysToExpiry}d until expiry — hard stop is ${rule.hard_stop_days}d`,
        ...rule,
      };
    }

    if (daysToExpiry < requiredDays) {
      return {
        status: 'BLOCK',
        days_to_expiry: daysToExpiry,
        message: `${daysToExpiry}d until expiry but course needs ${requiredDays}d (${courseDays}d + ${rule.safety_buffer_days}d buffer)`,
        ...rule,
      };
    }

    if (daysToExpiry < rule.warning_days) {
      return {
        status: 'WARN',
        days_to_expiry: daysToExpiry,
        message: `Expiry in ${daysToExpiry}d — below ${rule.warning_days}d warning threshold`,
        ...rule,
      };
    }

    return {
      status: 'ALLOW',
      days_to_expiry: daysToExpiry,
      message: `${daysToExpiry}d until expiry — safe to dispense`,
      ...rule,
    };
  }
}
