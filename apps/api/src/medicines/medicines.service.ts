import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, Not, IsNull } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';

@Injectable()
export class MedicinesService {
  constructor(
    @InjectRepository(Medicine)
    private medicinesRepo: Repository<Medicine>,
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
  ) {}

  async findAll(search?: string, category?: string, scheduleClass?: string) {
    const qb = this.medicinesRepo.createQueryBuilder('m');

    if (search) {
      qb.where(
        '(m.brand_name ILIKE :s OR m.molecule ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    if (category) qb.andWhere('m.category = :category', { category });
    if (scheduleClass) qb.andWhere('m.schedule_class = :sc', { sc: scheduleClass });

    qb.orderBy('m.brand_name', 'ASC');
    return qb.getMany();
  }

  async findOne(id: string) {
    const med = await this.medicinesRepo.findOne({ where: { id } });
    if (!med) throw new NotFoundException('Medicine not found');
    return med;
  }

  async create(dto: CreateMedicineDto) {
    if (!dto.substitute_group_key) {
      dto.substitute_group_key = `${dto.molecule?.toLowerCase().replace(/\s+/g, '_')}_${dto.strength?.toLowerCase().replace(/\s+/g, '')}_${dto.dosage_form?.toLowerCase()}`;
    }
    const medicine = this.medicinesRepo.create(dto);
    return this.medicinesRepo.save(medicine);
  }

  async update(id: string, dto: UpdateMedicineDto) {
    const medicine = await this.findOne(id);
    Object.assign(medicine, dto);
    return this.medicinesRepo.save(medicine);
  }

  async deactivate(id: string) {
    const medicine = await this.findOne(id);
    medicine.is_active = false;
    return this.medicinesRepo.save(medicine);
  }

  async getSubstitutes(id: string) {
    const medicine = await this.findOne(id);
    if (!medicine.substitute_group_key) return [];

    const substitutes = await this.medicinesRepo.find({
      where: {
        substitute_group_key: medicine.substitute_group_key,
        is_active: true,
      },
    });

    const result = [];
    for (const sub of substitutes) {
      if (sub.id === id) continue;

      const batches = await this.batchRepo
        .createQueryBuilder('b')
        .where('b.medicine_id = :mid', { mid: sub.id })
        .andWhere('b.quantity > 0')
        .andWhere('b.expiry_date > NOW()')
        .orderBy('b.expiry_date', 'ASC')
        .getMany();

      const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);
      result.push({
        ...sub,
        available_stock: totalStock,
        batches: batches.slice(0, 3),
      });
    }

    return result.sort((a, b) => b.available_stock - a.available_stock);
  }

  async getWithStock() {
    return this.medicinesRepo
      .createQueryBuilder('m')
      .leftJoinAndSelect('m.batches', 'b', 'b.quantity > 0 AND b.expiry_date > NOW()')
      .where('m.is_active = true')
      .getMany();
  }
}
