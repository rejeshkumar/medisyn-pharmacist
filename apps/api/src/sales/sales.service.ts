import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Sale } from '../database/entities/sale.entity';
import { Tenant } from '../database/entities/tenant.entity';
import { SaleItem } from '../database/entities/sale-item.entity';
import { StockBatch } from '../database/entities/stock-batch.entity';
import { Medicine, ScheduleClass } from '../database/entities/medicine.entity';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AuditService, AuditEntry } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import * as dayjs from 'dayjs';
import { AutoCarePlanService } from '../ai-care/auto-care-plan.service';

export interface UserContext {
  id: string;
  full_name: string;
  role: string;
  tenant_id: string;
}

@Injectable()
export class SalesService {
  private readonly logger = new Logger(SalesService.name);

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
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
    private dataSource: DataSource,
    private auditService: AuditService,
    private autoCarePlan: AutoCarePlanService,
  ) {}

  async createSale(dto: CreateSaleDto, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
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
          where: { id: item.batch_id, tenant_id: tenantId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!batch) throw new NotFoundException(`Batch ${item.batch_id} not found`);
        if (batch.quantity < item.qty) {
          throw new BadRequestException(
            `Insufficient stock for batch ${batch.batch_number}. Available: ${batch.quantity}`,
          );
        }

        const medicine = await queryRunner.manager.findOne(Medicine, {
          where: { id: batch.medicine_id, tenant_id: tenantId },
        });

        if (!medicine) throw new NotFoundException(`Medicine not found`);

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
        batch.updated_by = userId;
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
          medicine,
        });
      }

      const discountAmount =
        dto.discount_amount || (subtotal * (dto.discount_percent || 0)) / 100;
      const totalAmount = subtotal + taxAmount - discountAmount;
      const billNumber = await this.generateBillNumber(tenantId);

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
        tenant_id: tenantId,
      });

      const savedSale = await queryRunner.manager.save(Sale, sale);

      for (const itemData of saleItemsData) {
        const { medicine, ...itemFields } = itemData;

        const saleItem = queryRunner.manager.create(SaleItem, {
          ...itemFields,
          sale_id: savedSale.id,
          tenant_id: tenantId,
          created_by: userId,
        });
        const savedItem = await queryRunner.manager.save(SaleItem, saleItem);

        // Schedule drug log — H, H1, X
        if (
          dto.compliance_data &&
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
            tenant_id: tenantId,
            created_by: userId,
          });
          await queryRunner.manager.save(ScheduleDrugLog, log);
        }
      }

      await queryRunner.commitTransaction();

      // ── Auto AI Care plans — fire & forget, don't block sale ─────────
      this.autoCarePlan.createPlansFromSale(
        savedSale.id,
        tenantId,
        null,
        dto.customer_name || '',
        '',
        dto.doctor_name || '',
        dto.items.map(i => ({
          medicine_id:      i.medicine_id,
          medicine_name:    saleItemsData.find(s => s.medicine_id === i.medicine_id)?.medicine_name || '',
          qty:              i.qty,
          create_care_plan: (i as any).create_care_plan,
          is_chronic:       (i as any).is_chronic,
          chronic_category: (i as any).chronic_category,
        })),
      ).catch(err => this.logger.warn(`Auto care plan failed: ${err.message}`));

      // Audit log AFTER successful commit
      await this.auditService.log({
        tenantId,
        userId,
        userName:  user.full_name,
        userRole:  user.role,
        action:    AuditAction.DISPENSE,
        entity:    'Sale',
        entityId:  savedSale.id,
        entityRef: `Bill #${billNumber}`,
        newValue: {
          bill_number:   billNumber,
          total_amount:  totalAmount,
          payment_mode:  dto.payment_mode,
          items_count:   dto.items.length,
          has_scheduled: hasScheduledDrugs,
          customer:      dto.customer_name,
        },
      });

      return this.findOne(savedSale.id, tenantId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findAll(tenantId: string, from?: string, to?: string, search?: string) {
    const qb = this.saleRepo
      .createQueryBuilder('s')
      .where('s.tenant_id = :tenantId', { tenantId })
      .orderBy('s.created_at', 'DESC');

    if (from && to) {
      qb.andWhere('s.created_at BETWEEN :from AND :to', {
        from: new Date(from),
        to:   new Date(to + 'T23:59:59'),
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

  async findOne(id: string, tenantId: string) {
    const sale = await this.saleRepo.findOne({
      where: { id, tenant_id: tenantId },
      relations: ['items', 'items.medicine', 'items.batch'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    // Attach tenant/clinic info for bill rendering
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return { ...sale, clinic: tenant ? {
      name:       tenant.name,
      address:    tenant.address,
      phone:      tenant.phone,
      landline:   (tenant as any).landline,
      email:      tenant.email,
      gstin:      tenant.gstin,
      pan:        (tenant as any).pan,
      dl_numbers: (tenant as any).dl_numbers,
      logo_url:   tenant.logo_url,
    } : null };
  }

  async findByBillNumber(billNumber: string, tenantId: string) {
    const sale = await this.saleRepo.findOne({
      where: { bill_number: billNumber, tenant_id: tenantId },
      relations: ['items', 'items.medicine', 'items.batch'],
    });
    if (!sale) throw new NotFoundException('Bill not found');
    return sale;
  }

  async voidSale(id: string, reason: string, user: UserContext) {
    const { id: userId, tenant_id: tenantId } = user;
    const sale = await this.findOne(id, tenantId);
    if (sale.is_voided) throw new BadRequestException('Bill is already voided');

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of sale.items) {
        const batch = await queryRunner.manager.findOne(StockBatch, {
          where: { id: item.batch_id, tenant_id: tenantId },
          lock: { mode: 'pessimistic_write' },
        });
        if (batch) {
          batch.quantity += item.qty;
          batch.updated_by = userId;
          await queryRunner.manager.save(StockBatch, batch);
        }
      }

      sale.is_voided    = true;
      sale.voided_by    = userId;
      sale.voided_reason = reason;
      sale.updated_by   = userId;
      await queryRunner.manager.save(Sale, sale);
      await queryRunner.commitTransaction();

      // Audit log
      await this.auditService.log({
        tenantId,
        userId,
        userName:  user.full_name,
        userRole:  user.role,
        action:    AuditAction.VOID,
        entity:    'Sale',
        entityId:  id,
        entityRef: `Bill #${sale.bill_number}`,
        oldValue:  { is_voided: false },
        newValue:  { is_voided: true, voided_reason: reason },
      });

      return { message: 'Bill voided successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async generateBillNumber(tenantId: string): Promise<string> {
    const today = dayjs().format('YYYYMMDD');
    // Use raw query to avoid transaction isolation issues
    const result = await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt FROM sales WHERE tenant_id = $1`,
      [tenantId],
    ).catch(() => [{ cnt: 0 }]);
    const count = Number(result[0]?.cnt ?? 0);
    return `BILL-${today}-${String(count + 1).padStart(4, '0')}`;
  }
}
