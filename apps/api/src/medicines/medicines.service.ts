import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';

@Injectable()
export class MedicinesService {
  constructor(
    @InjectRepository(Medicine)
    private medicinesRepo: Repository<Medicine>,
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
    private auditService: AuditService,
    private dataSource: DataSource,
  ) {}

  async findAll(tenantId: string, search?: string, category?: string, scheduleClass?: string, withStock?: boolean) { 
    const qb = this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId });

    if (withStock) {
      // For prescription autocomplete, only surface active medicines
      qb.andWhere('m.is_active = true');
    }

    if (search) {
      qb.andWhere(
        '(m.brand_name ILIKE :s OR m.molecule ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (category)      qb.andWhere('m.category = :category',    { category });
    if (scheduleClass) qb.andWhere('m.schedule_class = :sc',    { sc: scheduleClass });

    if (withStock) {
      // Join valid stock batches and return availability counts
      qb.leftJoinAndSelect('m.batches', 'b', 'b.quantity > 0 AND b.expiry_date > NOW()');
      qb.orderBy('m.brand_name', 'ASC').limit(15);
      const meds = await qb.getMany();
      return meds.map(m => ({
        ...m,
        available_stock: (m.batches || []).reduce((sum: number, b: any) => sum + Number(b.quantity), 0),
        has_stock: (m.batches || []).some((b: any) => Number(b.quantity) > 0),
      }));
    }

    qb.orderBy('m.brand_name', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string, tenantId: string) {
    const med = await this.medicinesRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!med) throw new NotFoundException('Medicine not found');
    return med;
  }

  async create(dto: CreateMedicineDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;

    if (!dto.substitute_group_key) {
      dto.substitute_group_key = `${dto.molecule?.toLowerCase().replace(/\s+/g, '_')}_${dto.strength?.toLowerCase().replace(/\s+/g, '')}_${dto.dosage_form?.toLowerCase()}`;
    }

    const medicine = this.medicinesRepo.create({
      ...dto,
      tenant_id:  tenantId,
      created_by: userId,
    });
    const saved = await this.medicinesRepo.save(medicine);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.CREATE,
      entity:    'Medicine',
      entityId:  saved.id,
      entityRef: `${saved.brand_name} ${saved.strength}`,
      newValue:  { brand_name: saved.brand_name, molecule: saved.molecule, schedule_class: saved.schedule_class },
    });

    return saved;
  }

  async update(id: string, dto: UpdateMedicineDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const medicine = await this.findOne(id, tenantId);
    const oldValue = { brand_name: medicine.brand_name, schedule_class: medicine.schedule_class, is_active: medicine.is_active };

    Object.assign(medicine, dto);
    medicine.updated_by = userId;
    const saved = await this.medicinesRepo.save(medicine);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.UPDATE,
      entity:    'Medicine',
      entityId:  id,
      entityRef: `${medicine.brand_name} ${medicine.strength}`,
      oldValue,
      newValue:  dto as Record<string, any>,
    });

    return saved;
  }

  async deactivate(id: string, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const medicine = await this.findOne(id, tenantId);

    medicine.is_active  = false;
    medicine.updated_by = userId;
    const saved = await this.medicinesRepo.save(medicine);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.DEACTIVATE,
      entity:    'Medicine',
      entityId:  id,
      entityRef: `${medicine.brand_name} ${medicine.strength}`,
      oldValue:  { is_active: true },
      newValue:  { is_active: false },
    });

    return saved;
  }

  async getSubstitutes(id: string, tenantId: string) {
    const medicine = await this.findOne(id, tenantId);
    if (!medicine.substitute_group_key) return [];

    const substitutes = await this.medicinesRepo.find({
      where: {
        substitute_group_key: medicine.substitute_group_key,
        is_active: true,
        tenant_id: tenantId,
      },
    });

    const result = [];
    for (const sub of substitutes) {
      if (sub.id === id) continue;

      const batches = await this.batchRepo
        .createQueryBuilder('b')
        .where('b.medicine_id = :mid', { mid: sub.id })
        .andWhere('b.tenant_id = :tenantId', { tenantId })
        .andWhere('b.quantity > 0')
        .andWhere('b.expiry_date > NOW()')
        .orderBy('b.expiry_date', 'ASC')
        .getMany();

      const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
      result.push({ ...sub, available_stock: totalStock, batches: batches.slice(0, 3) });
    }

    return result.sort((a, b) => b.available_stock - a.available_stock);
  }

  async getWithStock(tenantId: string) {
    return this.medicinesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.batches', 'b', 'b.quantity > 0 AND b.expiry_date > NOW()')
      .where('m.is_active = true')
      .andWhere('m.tenant_id = :tenantId', { tenantId })
      .getMany();
  }

  async lookupBarcode(barcode: string, tenantId: string) {
    // 1. Check batch barcode (manufacturer label on box)
    const batchRows = await this.dataSource.query(
      `SELECT sb.id, sb.batch_number, sb.expiry_date, sb.quantity, sb.sale_rate,
              m.id as med_id, m.brand_name, m.molecule, m.strength,
              m.dosage_form, m.schedule_class, m.gst_percent
       FROM stock_batches sb
       JOIN medicines m ON sb.medicine_id = m.id
       WHERE sb.barcode = $1 AND sb.tenant_id = $2 AND sb.quantity > 0
       ORDER BY sb.expiry_date ASC LIMIT 1`,
      [barcode, tenantId]
    ).catch(() => []);
    if (batchRows?.length) {
      const r = batchRows[0];
      return {
        medicine: { id: r.med_id, brand_name: r.brand_name, molecule: r.molecule,
                    strength: r.strength, dosage_form: r.dosage_form,
                    schedule_class: r.schedule_class, gst_percent: r.gst_percent },
        batch: { id: r.id, batch_number: r.batch_number, expiry_date: r.expiry_date,
                 quantity: r.quantity, sale_rate: r.sale_rate },
        source: 'batch',
      };
    }
    // 2. Check barcode mappings (custom mapped)
    const mappingRows = await this.dataSource.query(
      `SELECT bm.medicine_id, m.id, m.brand_name, m.molecule, m.strength,
              m.dosage_form, m.schedule_class, m.gst_percent
       FROM barcode_mappings bm
       JOIN medicines m ON bm.medicine_id = m.id
       WHERE bm.barcode = $1 AND bm.tenant_id = $2 LIMIT 1`,
      [barcode, tenantId]
    ).catch(() => []);
    if (mappingRows?.length) {
      const med = mappingRows[0];
      const batches = await this.dataSource.query(
        `SELECT * FROM stock_batches WHERE medicine_id = $1 AND tenant_id = $2
         AND quantity > 0 AND expiry_date > NOW() ORDER BY expiry_date ASC LIMIT 1`,
        [med.id, tenantId]
      ).catch(() => []);
      return {
        medicine: { id: med.id, brand_name: med.brand_name, molecule: med.molecule,
                    strength: med.strength, dosage_form: med.dosage_form,
                    schedule_class: med.schedule_class, gst_percent: med.gst_percent },
        batch: batches?.[0] ?? null,
        source: 'mapping',
      };
    }
    return { medicine: null, batch: null, source: null };
  }

  async getBarcodeMappings(tenantId: string) {
    return this.dataSource.query(
      `SELECT bm.id, bm.barcode, bm.created_at,
              m.id as medicine_id, m.brand_name, m.molecule, m.strength
       FROM barcode_mappings bm
       LEFT JOIN medicines m ON bm.medicine_id = m.id
       WHERE bm.tenant_id = $1 ORDER BY bm.created_at DESC`,
      [tenantId]
    ).catch(() => []);
  }

  async createBarcodeMapping(dto: { barcode: string; medicine_id: string }, actor: any) {
    await this.dataSource.query(
      `INSERT INTO barcode_mappings(tenant_id, barcode, medicine_id, created_by)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(tenant_id, barcode) DO UPDATE SET medicine_id = EXCLUDED.medicine_id`,
      [actor.tenant_id, dto.barcode, dto.medicine_id, actor.id]
    );
    return { success: true, barcode: dto.barcode, medicine_id: dto.medicine_id };
  }

  async stockCheck(medicineName: string, tenantId: string) {
    // Find the medicine by brand name (fuzzy)
    const medicines = await this.dataSource.query(
      `SELECT m.id, m.brand_name, m.molecule, m.strength, m.dosage_form,
              COALESCE(SUM(sb.quantity), 0)::int as quantity
       FROM medicines m
       LEFT JOIN stock_batches sb ON sb.medicine_id = m.id
         AND sb.tenant_id = $1 AND sb.quantity > 0 AND sb.expiry_date > NOW()
       WHERE m.tenant_id = $1
         AND LOWER(m.brand_name) LIKE LOWER($2)
       GROUP BY m.id, m.brand_name, m.molecule, m.strength, m.dosage_form
       LIMIT 1`,
      [tenantId, `%${medicineName}%`]
    ).catch(() => []);

    if (!medicines?.length) {
      return { quantity: -1, alternatives: [] };
    }

    const med = medicines[0];
    const quantity = med.quantity;

    // If out of stock, find alternatives with same molecule
    let alternatives: any[] = [];
    if (quantity === 0 && med.molecule) {
      alternatives = await this.dataSource.query(
        `SELECT m.id, m.brand_name, m.strength,
                COALESCE(SUM(sb.quantity), 0)::int as quantity
         FROM medicines m
         LEFT JOIN stock_batches sb ON sb.medicine_id = m.id
           AND sb.tenant_id = $1 AND sb.quantity > 0 AND sb.expiry_date > NOW()
         WHERE m.tenant_id = $1
           AND LOWER(m.molecule) = LOWER($2)
           AND m.id != $3
         GROUP BY m.id, m.brand_name, m.strength
         HAVING COALESCE(SUM(sb.quantity), 0) > 0
         ORDER BY quantity DESC
         LIMIT 5`,
        [tenantId, med.molecule, med.id]
      ).catch(() => []);
    }

    return { quantity, alternatives };
  }
  async searchEnriched(tenantId: string, search: string, limit = 20): Promise<any[]> {
    return this.dataSource.query(
      `SELECT
         m.id, m.brand_name, m.molecule, m.strength, m.dosage_form,
         m.schedule_class::text AS schedule_class,
         m.gst_percent, m.mrp, m.sale_rate, m.manufacturer,
         m.rack_location, m.treatment_for, m.reorder_qty,
         COALESCE(m.is_chronic, false) AS is_chronic,
         m.chronic_category,
         false AS is_generic,
         CASE m.schedule_class::text
           WHEN 'OTC' THEN 'Over the Counter'
           WHEN 'H'   THEN 'Schedule H — Prescription required'
           WHEN 'H1'  THEN 'Schedule H1 — Restricted prescription'
           WHEN 'X'   THEN 'Schedule X — Narcotic (Form 17)'
           ELSE m.schedule_class::text
         END AS schedule_label,
         COALESCE((
           SELECT SUM(sb.quantity)
           FROM stock_batches sb
           WHERE sb.medicine_id = m.id AND sb.tenant_id = $1
             AND sb.quantity > 0 AND sb.expiry_date > CURRENT_DATE
         ), 0) AS total_stock,
         (SELECT row_to_json(fb)
          FROM (
            SELECT b.id, b.batch_number, b.expiry_date, b.sale_rate, b.quantity
            FROM stock_batches b
            WHERE b.medicine_id = m.id AND b.tenant_id = $1
              AND b.quantity > 0 AND b.expiry_date > CURRENT_DATE
            ORDER BY b.expiry_date ASC LIMIT 1
          ) fb) AS fefo_batch,
         (SELECT json_agg(ab ORDER BY ab.expiry_date ASC)
          FROM (
            SELECT b.id, b.batch_number, b.expiry_date,
                   b.sale_rate, b.mrp, b.purchase_price, b.quantity, b.barcode,
                   (b.expiry_date - CURRENT_DATE)::int AS days_to_expiry
            FROM stock_batches b
            WHERE b.medicine_id = m.id AND b.tenant_id = $1
              AND b.quantity > 0 AND b.expiry_date > CURRENT_DATE
            ORDER BY b.expiry_date ASC
          ) ab) AS all_batches,
         COALESCE((
           SELECT COUNT(DISTINCT m2.id)
           FROM medicines m2
           WHERE m2.molecule = m.molecule AND m2.molecule IS NOT NULL
             AND m2.molecule != '' AND m2.id != m.id
             AND m2.tenant_id = $1 AND m2.is_active = true
             AND EXISTS (
               SELECT 1 FROM stock_batches sb2
               WHERE sb2.medicine_id = m2.id AND sb2.tenant_id = $1
                 AND sb2.quantity > 0 AND sb2.expiry_date > CURRENT_DATE
             )
         ), 0) AS substitute_count
       FROM medicines m
       WHERE m.tenant_id = $1 AND m.is_active = true
         AND (m.brand_name ILIKE $2 OR m.molecule ILIKE $2 OR m.treatment_for ILIKE $2)
       ORDER BY
         CASE WHEN m.brand_name ILIKE $3 THEN 0 ELSE 1 END,
         CASE WHEN COALESCE((
           SELECT SUM(sb.quantity) FROM stock_batches sb
           WHERE sb.medicine_id = m.id AND sb.tenant_id = $1
             AND sb.quantity > 0 AND sb.expiry_date > CURRENT_DATE
         ), 0) > 0 THEN 0 ELSE 1 END,
         m.brand_name ASC
       LIMIT $4`,
      [tenantId, `%${search}%`, `${search}%`, limit],
    ).catch((err: any) => {
      console.error('[searchEnriched] failed:', err.message);
      return [];
    });
  }

}
// force rebuild Sun Apr  5 20:06:04 IST 2026
