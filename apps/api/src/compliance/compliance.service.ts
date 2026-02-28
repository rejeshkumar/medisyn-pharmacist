import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleDrugLog } from '../database/entities/schedule-drug-log.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ComplianceService {
  constructor(
    @InjectRepository(ScheduleDrugLog)
    private logRepo: Repository<ScheduleDrugLog>,
  ) {}

  async getScheduleDrugLog(filters: {
    from?: string;
    to?: string;
    doctorName?: string;
    medicine?: string;
    scheduleClass?: string;
  }) {
    const qb = this.logRepo
      .createQueryBuilder('l')
      .leftJoinAndSelect('l.pharmacist', 'u')
      .orderBy('l.created_at', 'DESC');

    if (filters.from && filters.to) {
      qb.where('l.created_at BETWEEN :from AND :to', {
        from: new Date(filters.from),
        to: new Date(filters.to + 'T23:59:59'),
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

  async exportToExcel(filters: any): Promise<Buffer> {
    const logs = await this.getScheduleDrugLog(filters);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Schedule Drug Register');

    sheet.columns = [
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Patient Name', key: 'patient_name', width: 25 },
      { header: 'Doctor Name', key: 'doctor_name', width: 25 },
      { header: 'Doctor Reg No', key: 'doctor_reg_no', width: 20 },
      { header: 'Medicine', key: 'medicine_name', width: 30 },
      { header: 'Schedule Class', key: 'schedule_class', width: 15 },
      { header: 'Qty Dispensed', key: 'qty', width: 15 },
      { header: 'Batch No', key: 'batch_number', width: 20 },
      { header: 'Pharmacist', key: 'pharmacist', width: 25 },
      { header: 'Substituted', key: 'is_substituted', width: 12 },
      { header: 'Substitution Reason', key: 'substitution_reason', width: 25 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2D7D46' },
    };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const log of logs) {
      sheet.addRow({
        date: new Date(log.created_at).toLocaleString('en-IN'),
        patient_name: log.patient_name,
        doctor_name: log.doctor_name,
        doctor_reg_no: log.doctor_reg_no || '-',
        medicine_name: log.medicine_name,
        schedule_class: log.schedule_class,
        qty: log.quantity_dispensed,
        batch_number: log.batch_number,
        pharmacist: log.pharmacist?.full_name || '-',
        is_substituted: log.is_substituted ? 'Yes' : 'No',
        substitution_reason: log.substitution_reason || '-',
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
