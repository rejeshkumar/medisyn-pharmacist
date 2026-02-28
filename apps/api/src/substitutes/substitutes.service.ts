import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Medicine } from '../database/entities/medicine.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';

@Injectable()
export class SubstitutesService {
  constructor(
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
  ) {}

  async getSubstitutes(medicineId: string) {
    const medicine = await this.medicineRepo.findOne({
      where: { id: medicineId },
    });
    if (!medicine || !medicine.substitute_group_key) return [];

    const substitutes = await this.medicineRepo.find({
      where: {
        substitute_group_key: medicine.substitute_group_key,
        is_active: true,
      },
    });

    const result = [];
    for (const sub of substitutes) {
      if (sub.id === medicineId) continue;

      const batches = await this.batchRepo
        .createQueryBuilder('b')
        .where('b.medicine_id = :mid', { mid: sub.id })
        .andWhere('b.quantity > 0')
        .andWhere('b.expiry_date > NOW()')
        .orderBy('b.expiry_date', 'ASC')
        .getMany();

      const totalStock = batches.reduce((sum, b) => sum + b.quantity, 0);

      result.push({
        id: sub.id,
        brand_name: sub.brand_name,
        molecule: sub.molecule,
        strength: sub.strength,
        dosage_form: sub.dosage_form,
        mrp: sub.mrp,
        sale_rate: sub.sale_rate,
        available_stock: totalStock,
        best_batch: batches[0] || null,
      });
    }

    return result.sort((a, b) => {
      if (b.available_stock !== a.available_stock)
        return b.available_stock - a.available_stock;
      return (a.sale_rate || 0) - (b.sale_rate || 0);
    });
  }
}
