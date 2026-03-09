import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {}

  async findAll(tenantId: string, search?: string, category?: string, scheduleClass?: string) {
    const qb = this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.tenant_id = :tenantId', { tenantId });

    if (search) {
      qb.andWhere(
        '(m.brand_name ILIKE :s OR m.molecule ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (category)      qb.andWhere('m.category = :category',    { category });
    if (scheduleClass) qb.andWhere('m.schedule_class = :sc',    { sc: scheduleClass });

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
}
