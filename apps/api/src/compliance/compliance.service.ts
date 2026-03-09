import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ScheduleDrugLog)
    private logRepo: Repository<ScheduleDrugLog>,
    private auditService: AuditService,
  ) {}

  async getScheduleDrugLog(
    tenantId: string,
    filters: {
      from?: string;
      to?: string;
      doctorName?: string;
      medicine?: string;
      scheduleClass?: string;
    },
  ) {
    const qb = this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.pharmacist', 'u')
      .where('l.tenant_id = :tenantId', { tenantId })
      .orderBy('l.created_at', 'DESC');

    if (filters.from && filters.to) {
      qb.andWhere('l.created_at BETWEEN :from AND :to', {
        from: new Date(filters.from),
        to:   new Date(filters.to + 'T23:59:59'),
      });
    }
    if (filters.doctorName) {
      qb.andWhere('l.doctor_name ILIKE :dn', { dn: `%${filters.doctorName}%` });
    }
    if (filters.medicine) {
      qb.andWhere('l.medicine_name ILIKE :med', { med: `%${filters.medicine}%` });
    }
    if (filters.scheduleClass) {
      qb.andWhere('l.schedule_class = :sc', { sc: filters.scheduleClass });
    }

    return qb.getMany();
  }

  async exportToExcel(tenantId: string, filters: any, user: UserContext): Promise<Buffer> {
    const logs = await this.getScheduleDrugLog(tenantId, filters);

    // Audit log — record that an inspector-level export was performed
    await this.auditService.log({
      tenantId,
      userId:    user.id,
      userName:  user.full_name,
      userRole:  user.role,
      action:    AuditAction.EXPORT,
      entity:    'ScheduleDrugLog',
      entityRef: `Schedule Drug Register Export — ${filters.from || 'all'} to ${filters.to || 'all'}`,
      newValue:  { filters, record_count: logs.length },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet    = workbook.addWorksheet('Schedule Drug Register');

    sheet.columns = [
      { header: 'Date',                key: 'date',                width: 20 },
      { header: 'Patient Name',        key: 'patient_name',        width: 25 },
      { header: 'Doctor Name',         key: 'doctor_name',         width: 25 },
      { header: 'Doctor Reg No',       key: 'doctor_reg_no',       width: 20 },
      { header: 'Medicine',            key: 'medicine_name',       width: 30 },
      { header: 'Schedule Class',      key: 'schedule_class',      width: 15 },
      { header: 'Qty Dispensed',       key: 'qty',                 width: 15 },
      { header: 'Batch No',            key: 'batch_number',        width: 20 },
      { header: 'Dispensed By',        key: 'pharmacist',          width: 25 },
      { header: 'Substituted',         key: 'is_substituted',      width: 12 },
      { header: 'Substitution Reason', key: 'substitution_reason', width: 25 },
    ];

    // Header row styling
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type:    'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF00475A' }, // MediSyn brand colour
    };

    for (const log of logs) {
      sheet.addRow({
        date:                new Date(log.created_at).toLocaleString('en-IN'),
        patient_name:        log.patient_name,
        doctor_name:         log.doctor_name,
        doctor_reg_no:       log.doctor_reg_no || '-',
        medicine_name:       log.medicine_name,
        schedule_class:      log.schedule_class,
        qty:                 log.quantity_dispensed,
        batch_number:        log.batch_number,
        pharmacist:          log.pharmacist?.full_name || '-',
        is_substituted:      log.is_substituted ? 'Yes' : 'No',
        substitution_reason: log.substitution_reason || '-',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
