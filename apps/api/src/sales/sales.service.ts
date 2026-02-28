import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine } from '../database/entities/medicine.entity';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { ScheduleClass } from '../database/entities/medicine.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import * as dayjs from 'dayjs';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private saleRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private saleItemRepo: Repository<SaleItem>,
    @InjectRepository(StockBatch)
    private batchRepo: Repository<StockBatch>,
    @InjectRepository(Medicine)
    private medicineRepo: Repository<Medicine>,
    @InjectRepository(ScheduleDrugLog)
    private scheduleLogRepo: Repository<ScheduleDrugLog>,
    private dataSource: DataSource,
  ) {}

  async createSale(dto: CreateSaleDto, userId: string) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let subtotal = 0;
      let taxAmount = 0;
      const saleItemsData = [];
      let hasScheduledDrugs = false;

      for (const item of dto.items) {
        const batch = await queryRunner.manager.findOne(StockBatch, {
          where: { id: item.batch_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (batch) {
          batch.medicine = await queryRunner.manager.findOne(Medicine, {
            where: { id: batch.medicine_id },
          });
        }

        if (!batch) throw new NotFoundException(`Batch ${item.batch_id} not found`);
        if (batch.quantity < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for batch ${batch.batch_number}. Available: ${batch.quantity}`,
          );
        }

        const medicine = batch.medicine;
        const rate = item.rate || batch.sale_rate;
        const itemSubtotal = rate * item.qty;
        const gstPercent = item.gst_percent ?? medicine.gst_percent ?? 0;
        const itemTax = (itemSubtotal * gstPercent) / 100;

        subtotal += itemSubtotal;
        taxAmount += itemTax;

        if (
          medicine.schedule_class === ScheduleClass.H1 ||
          medicine.schedule_class === ScheduleClass.X
        ) {
          hasScheduledDrugs = true;
        }

        batch.quantity -= item.qty;
        await queryRunner.manager.save(StockBatch, batch);

        saleItemsData.push({
          medicine_id: item.medicine_id,
          batch_id: item.batch_id,
          qty: item.qty,
          rate,
          gst_percent: gstPercent,
          item_total: itemSubtotal + itemTax,
          is_substituted: item.is_substituted || false,
          original_medicine_id: item.original_medicine_id,
          substitution_reason: item.substitution_reason,
          medicine_name: medicine.brand_name,
          batch_number: batch.batch_number,
        });
      }

      const discountAmount =
        dto.discount_amount || (subtotal * (dto.discount_percent || 0)) / 100;
      const totalAmount = subtotal + taxAmount - discountAmount;

      const billNumber = await this.generateBillNumber();

      const sale = queryRunner.manager.create(Sale, {
        bill_number: billNumber,
        customer_name: dto.customer_name,
        doctor_name: dto.doctor_name,
        doctor_reg_no: dto.doctor_reg_no,
        subtotal,
        discount_amount: discountAmount,
        discount_percent: dto.discount_percent || 0,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        payment_mode: dto.payment_mode,
        prescription_image_url: dto.prescription_image_url,
        ai_prescription_id: dto.ai_prescription_id,
        notes: dto.notes,
        has_scheduled_drugs: hasScheduledDrugs,
        created_by: userId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);

      for (const itemData of saleItemsData) {
        const saleItem = queryRunner.manager.create(SaleItem, {
          ...itemData,
          sale_id: savedSale.id,
        });
        const savedItem = await queryRunner.manager.save(SaleItem, saleItem);

        if (
          dto.compliance_data &&
          (itemData.is_substituted ||
            (await this.isScheduledDrug(itemData.medicine_id)))
        ) {
          const medicine = await queryRunner.manager.findOne(Medicine, {
            where: { id: itemData.medicine_id },
          });
          if (
            medicine &&
            (medicine.schedule_class === ScheduleClass.H ||
              medicine.schedule_class === ScheduleClass.H1 ||
              medicine.schedule_class === ScheduleClass.X)
          ) {
            const log = queryRunner.manager.create(ScheduleDrugLog, {
              sale_id: savedSale.id,
              sale_item_id: savedItem.id,
              patient_name: dto.compliance_data.patient_name,
              doctor_name: dto.compliance_data.doctor_name,
              doctor_reg_no: dto.compliance_data.doctor_reg_no,
              prescription_image_url: dto.prescription_image_url,
              medicine_name: medicine.brand_name,
              schedule_class: medicine.schedule_class,
              quantity_dispensed: itemData.qty,
              batch_number: itemData.batch_number,
              pharmacist_id: userId,
              is_substituted: itemData.is_substituted,
              substitution_reason: itemData.substitution_reason,
            });
            await queryRunner.manager.save(ScheduleDrugLog, log);
          }
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedSale.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async isScheduledDrug(medicineId: string): Promise<boolean> {
    const medicine = await this.medicineRepo.findOne({
      where: { id: medicineId },
    });
    return medicine && medicine.schedule_class !== ScheduleClass.OTC;
  }

  async findAll(from?: string, to?: string, search?: string) {
    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.pharmacist', 'u')
      .orderBy('s.created_at', 'DESC');

    if (from && to) {
      qb.where('s.created_at BETWEEN :from AND :to', {
        from: new Date(from),
        to: new Date(to + 'T23:59:59'),
      });
    }
    if (search) {
      qb.andWhere(
        '(s.bill_number ILIKE :s OR s.customer_name ILIKE :s)',
        { s: `%${search}%` },
      );
    }
    return qb.getMany();
  }

  async findOne(id: string) {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: ['items', 'items.medicine', 'items.batch', 'pharmacist'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async findByBillNumber(billNumber: string) {
    const sale = await this.saleRepo.findOne({
      where: { bill_number: billNumber },
      relations: ['items', 'items.medicine', 'items.batch', 'pharmacist'],
    });
    if (!sale) throw new NotFoundException('Bill not found');
    return sale;
  }

  async voidSale(id: string, reason: string, userId: string) {
    const sale = await this.findOne(id);
    if (sale.is_voided) throw new BadRequestException('Bill is already voided');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of sale.items) {
        const batch = await queryRunner.manager.findOne(StockBatch, {
          where: { id: item.batch_id },
          lock: { mode: 'pessimistic_write' },
        });
        if (batch) {
          batch.quantity += item.qty;
          await queryRunner.manager.save(StockBatch, batch);
        }
      }

      sale.is_voided = true;
      sale.voided_by = userId;
      sale.voided_reason = reason;
      await queryRunner.manager.save(Sale, sale);
      await queryRunner.commitTransaction();
      return { message: 'Bill voided successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateBillNumber(): Promise<string> {
    const today = dayjs().format('YYYYMMDD');
    const count = await this.saleRepo.count();
    return `BILL-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
