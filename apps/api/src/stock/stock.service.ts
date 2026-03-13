import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { StockAdjustment } from '../database/entities/stock-adjustment.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';
import * as dayjs from 'dayjs';

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
    @InjectRepository(StockAdjustment)
    private adjustmentRepo: Repository<StockAdjustment>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    private auditService: AuditService,
  ) {}

  async getStockList(tenantId: string, filters: {
    search?: string;
    expiryDays?: number;
    lowStock?: boolean;
    scheduleClass?: string;
    supplierId?: string;
    molecule?: string;
    category?: string;
  }) {
    const qb = this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .leftJoinAndSelect('b.supplier', 's')
      .where('b.is_active = true')
      .andWhere('b.tenant_id = :tenantId', { tenantId });

    if (filters.search) {
      qb.andWhere(
        '(m.brand_name ILIKE :search OR m.molecule ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.expiryDays) {
      const expiryDate = dayjs().add(filters.expiryDays, 'day').toDate();
      qb.andWhere('b.expiry_date <= :expiryDate', { expiryDate });
      qb.andWhere('b.expiry_date > NOW()');
    }
    if (filters.lowStock)      qb.andWhere('b.quantity <= 10');
    if (filters.scheduleClass) qb.andWhere('m.schedule_class = :sc',       { sc: filters.scheduleClass });
    if (filters.supplierId)    qb.andWhere('b.supplier_id = :sid',         { sid: filters.supplierId });
    if (filters.molecule)      qb.andWhere('m.molecule ILIKE :molecule',   { molecule: `%${filters.molecule}%` });
    if (filters.category)      qb.andWhere('m.category = :category',       { category: filters.category });

    qb.orderBy('m.brand_name', 'ASC').addOrderBy('b.expiry_date', 'ASC');
    return qb.getMany();
  }

  async getBatchesForMedicine(medicineId: string, tenantId: string) {
    return this.batchRepo.find({
      where: { medicine_id: medicineId, is_active: true, tenant_id: tenantId },
      order: { expiry_date: 'ASC' },
      relations: ['supplier'],
    });
  }

  async addPurchase(dto: AddPurchaseDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const batches = [];

    for (const item of dto.items) {
      const medicine = await this.medicineRepo.findOne({
        where: { id: item.medicine_id, tenant_id: tenantId },
      });
      if (!medicine) throw new NotFoundException(`Medicine ${item.medicine_id} not found`);

      const batch = this.batchRepo.create({
        medicine_id:         item.medicine_id,
        batch_number:        item.batch_number,
        expiry_date:         item.expiry_date,
        quantity:            item.quantity,
        purchase_price:      item.purchase_price,
        mrp:                 item.mrp,
        sale_rate:           item.sale_rate || item.mrp,
        supplier_id:         dto.supplier_id,
        purchase_invoice_no: dto.invoice_no,
        notes:               item.notes,
        tenant_id:           tenantId,
        created_by:          userId,
      });
      const saved = await this.batchRepo.save(batch);
      batches.push(saved);

      await this.auditService.log({
        tenantId, userId,
        userName:  user.full_name,
        userRole:  user.role,
        action:    AuditAction.STOCK_IN,
        entity:    'StockBatch',
        entityId:  saved.id,
        entityRef: `${medicine.brand_name} — Batch ${item.batch_number}`,
        newValue:  {
          medicine:  medicine.brand_name,
          batch:     item.batch_number,
          quantity:  item.quantity,
          expiry:    item.expiry_date,
          invoice:   dto.invoice_no,
        },
      });
    }

    return batches;
  }

  async adjustStock(dto: AdjustStockDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;

    const batch = await this.batchRepo.findOne({
      where: { id: dto.batch_id, tenant_id: tenantId },
      relations: ['medicine'],
    });
    if (!batch) throw new NotFoundException('Batch not found');

    const quantityBefore = batch.quantity;
    const quantityChange = -Math.abs(dto.quantity);
    const quantityAfter  = batch.quantity + quantityChange;

    if (quantityAfter < 0) {
      throw new BadRequestException('Adjustment quantity exceeds available stock');
    }

    batch.quantity   = quantityAfter;
    batch.updated_by = userId;
    await this.batchRepo.save(batch);

    const adjustment = this.adjustmentRepo.create({
      batch_id:        dto.batch_id,
      quantity_change: quantityChange,
      quantity_before: quantityBefore,
      quantity_after:  quantityAfter,
      adjustment_type: dto.adjustment_type,
      notes:           dto.notes,
      performed_by:    userId,
      tenant_id:       tenantId,
      created_by:      userId,
    });
    const saved = await this.adjustmentRepo.save(adjustment);

    await this.auditService.log({
      tenantId, userId,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.STOCK_ADJUST,
      entity:    'StockBatch',
      entityId:  dto.batch_id,
      entityRef: `${batch.medicine?.brand_name || 'Unknown'} — Batch ${batch.batch_number}`,
      oldValue:  { quantity: quantityBefore },
      newValue:  { quantity: quantityAfter, change: quantityChange, reason: dto.adjustment_type, notes: dto.notes },
    });

    return saved;
  }

  async getLowStockAlerts(tenantId: string, threshold = 10) {
    return this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .where('b.quantity <= :threshold', { threshold })
      .andWhere('b.quantity > 0')
      .andWhere('b.is_active = true')
      .andWhere('b.expiry_date > NOW()')
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.quantity', 'ASC')
      .getMany();
  }

  async getNearExpiryAlerts(tenantId: string, days = 90) {
    const targetDate = dayjs().add(days, 'day').toDate();
    return this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .where('b.expiry_date <= :targetDate', { targetDate })
      .andWhere('b.expiry_date > NOW()')
      .andWhere('b.quantity > 0')
      .andWhere('b.is_active = true')
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .orderBy('b.expiry_date', 'ASC')
      .getMany();
  }

  async getSuppliers(tenantId: string) {
    return this.supplierRepo.find({
      where: { is_active: true, tenant_id: tenantId },
      order: { name: 'ASC' },
    });
  }

  async createSupplier(
    data: { name: string; phone?: string; gstin?: string; address?: string },
    user: UserContext,
  ) {
    const { id: userId, tenant_id: tenantId } = user;
    const supplier = this.supplierRepo.create({
      ...data,
      tenant_id:  tenantId,
      created_by: userId,
    });
    return this.supplierRepo.save(supplier);
  }

  async getBestBatch(medicineId: string, tenantId: string) {
    return this.batchRepo
      .createQueryBuilder('b')
      .where('b.medicine_id = :mid', { mid: medicineId })
      .andWhere('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.quantity > 0')
      .andWhere('b.expiry_date > NOW()')
      .orderBy('b.expiry_date', 'ASC')  // FEFO
      .getOne();
  }

  async getExpiring(tenantId: string, days: number = 60) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    return this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .where('b.tenant_id = :tenantId', { tenantId })
      .andWhere('b.quantity > 0')
      .andWhere('b.expiry_date <= :cutoff', { cutoff })
      .andWhere('b.is_active = true')
      .orderBy('b.expiry_date', 'ASC')
      .getMany();
  }
}
