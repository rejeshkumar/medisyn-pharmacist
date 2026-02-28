import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { StockAdjustment, AdjustmentType } from '../database/entities/stock-adjustment.entity';
import { Supplier } from '../database/entities/supplier.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { AddPurchaseDto } from './dto/add-purchase.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
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
  ) {}

  async getStockList(filters: {
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
      .where('b.is_active = true');

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
    if (filters.lowStock) {
      qb.andWhere('b.quantity <= 10');
    }
    if (filters.scheduleClass) {
      qb.andWhere('m.schedule_class = :sc', { sc: filters.scheduleClass });
    }
    if (filters.supplierId) {
      qb.andWhere('b.supplier_id = :sid', { sid: filters.supplierId });
    }
    if (filters.molecule) {
      qb.andWhere('m.molecule ILIKE :molecule', { molecule: `%${filters.molecule}%` });
    }
    if (filters.category) {
      qb.andWhere('m.category = :category', { category: filters.category });
    }

    qb.orderBy('m.brand_name', 'ASC').addOrderBy('b.expiry_date', 'ASC');
    return qb.getMany();
  }

  async getBatchesForMedicine(medicineId: string) {
    return this.batchRepo.find({
      where: { medicine_id: medicineId, is_active: true },
      order: { expiry_date: 'ASC' },
      relations: ['supplier'],
    });
  }

  async addPurchase(dto: AddPurchaseDto, userId: string) {
    const batches = [];
    for (const item of dto.items) {
      const medicine = await this.medicineRepo.findOne({
        where: { id: item.medicine_id },
      });
      if (!medicine) throw new NotFoundException(`Medicine ${item.medicine_id} not found`);

      const batch = this.batchRepo.create({
        medicine_id: item.medicine_id,
        batch_number: item.batch_number,
        expiry_date: item.expiry_date,
        quantity: item.quantity,
        purchase_price: item.purchase_price,
        mrp: item.mrp,
        sale_rate: item.sale_rate || item.mrp,
        supplier_id: dto.supplier_id,
        purchase_invoice_no: dto.invoice_no,
        notes: item.notes,
      });
      batches.push(await this.batchRepo.save(batch));
    }
    return batches;
  }

  async adjustStock(dto: AdjustStockDto, userId: string) {
    const batch = await this.batchRepo.findOne({ where: { id: dto.batch_id } });
    if (!batch) throw new NotFoundException('Batch not found');

    const quantityBefore = batch.quantity;
    const quantityChange = -Math.abs(dto.quantity);
    const quantityAfter = batch.quantity + quantityChange;

    if (quantityAfter < 0) {
      throw new BadRequestException('Adjustment quantity exceeds available stock');
    }

    batch.quantity = quantityAfter;
    await this.batchRepo.save(batch);

    const adjustment = this.adjustmentRepo.create({
      batch_id: dto.batch_id,
      quantity_change: quantityChange,
      quantity_before: quantityBefore,
      quantity_after: quantityAfter,
      adjustment_type: dto.adjustment_type,
      notes: dto.notes,
      performed_by: userId,
    });
    return this.adjustmentRepo.save(adjustment);
  }

  async getLowStockAlerts(threshold = 10) {
    return this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .where('b.quantity <= :threshold', { threshold })
      .andWhere('b.quantity > 0')
      .andWhere('b.is_active = true')
      .andWhere('b.expiry_date > NOW()')
      .orderBy('b.quantity', 'ASC')
      .getMany();
  }

  async getNearExpiryAlerts(days = 90) {
    const targetDate = dayjs().add(days, 'day').toDate();
    return this.batchRepo
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.medicine', 'm')
      .where('b.expiry_date <= :targetDate', { targetDate })
      .andWhere('b.expiry_date > NOW()')
      .andWhere('b.quantity > 0')
      .andWhere('b.is_active = true')
      .orderBy('b.expiry_date', 'ASC')
      .getMany();
  }

  async getSuppliers() {
    return this.supplierRepo.find({ where: { is_active: true }, order: { name: 'ASC' } });
  }

  async createSupplier(data: { name: string; phone?: string; gstin?: string; address?: string }) {
    const supplier = this.supplierRepo.create(data);
    return this.supplierRepo.save(supplier);
  }

  async getBestBatch(medicineId: string) {
    return this.batchRepo
      .createQueryBuilder('b')
      .where('b.medicine_id = :mid', { mid: medicineId })
      .andWhere('b.quantity > 0')
      .andWhere('b.expiry_date > NOW()')
      .andWhere("b.expiry_date > NOW() + INTERVAL '30 days'")
      .orderBy('b.expiry_date', 'ASC')
      .getOne();
  }
}
