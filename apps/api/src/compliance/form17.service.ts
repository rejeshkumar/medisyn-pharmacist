// form17.service.ts
// Generates Form 17 (Poison Register) as required under Rule 65(11) of
// Drugs & Cosmetics Rules 1945 for Schedule X substances.
//
// Place this file in: apps/api/src/compliance/form17.service.ts
// Add to compliance.module.ts providers and exports.

import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as PDFDocument from 'pdfkit';

const CLINIC = {
  name:    'MEDISYN SPECIALITY CLINIC',
  address: 'TMC XVII-1260,1261,1264,1265, CHIRVAKKU JUNCTION, TALIPARAMBA, KANNUR, KERALA 670141',
  phone:   '6282208880',
  gstin:   '32ACEFM2008C1Z1',
  dl_no:   'RLF20KL2025003081 / RLF21KL2025003073',
};

export interface Form17Entry {
  serial_no:        number;
  date:             string;
  bill_number:      string;
  medicine_name:    string;
  batch_number:     string;
  quantity:         number;
  unit:             string;
  patient_name:     string;
  patient_address?: string;
  doctor_name:      string;
  doctor_reg_no?:   string;
  prescription_no?: string;
  pharmacist_name:  string;
}

@Injectable()
export class Form17Service {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Fetch Schedule X sale records for a date range ────────────────────────
  async getScheduleXEntries(
    tenantId: string,
    fromDate: string,
    toDate: string,
  ): Promise<Form17Entry[]> {
    const rows = await this.ds.query(
      `SELECT
          s.bill_number,
          s.created_at::date::text AS date,
          si.medicine_name,
          sb.batch_number,
          si.qty,
          s.customer_name AS patient_name,
          s.doctor_name,
          u.full_name AS pharmacist_name,
          COALESCE(m.schedule_class, '') AS schedule_class,
          '' AS doctor_reg_no,
          s.bill_number AS prescription_no
       FROM sale_items si
       JOIN sales s         ON s.id = si.sale_id
       LEFT JOIN medicines m ON m.id = si.medicine_id
       LEFT JOIN stock_batches sb ON sb.id = si.batch_id
       LEFT JOIN users u    ON u.id::text = s.created_by
       -- LEFT JOIN compliance_records comp ON comp.sale_id = s.id
       WHERE s.tenant_id = $1
         AND s.is_voided  = false
         AND m.schedule_class = 'X'
         AND s.created_at::date BETWEEN $2 AND $3
       ORDER BY s.created_at ASC`,
      [tenantId, fromDate, toDate],
    );

    return rows.map((r: any, idx: number) => ({
      serial_no:       idx + 1,
      date:            r.date,
      bill_number:     r.bill_number,
      medicine_name:   r.medicine_name,
      batch_number:    r.batch_number || '—',
      quantity:        Number(r.qty),
      unit:            'Nos',
      patient_name:    r.patient_name || 'Walk-in',
      doctor_name:     r.doctor_name  || '—',
      doctor_reg_no:   r.doctor_reg_no,
      prescription_no: r.prescription_no,
      pharmacist_name: r.pharmacist_name || '—',
    }));
  }

  // ── Generate Form 17 PDF ──────────────────────────────────────────────────
  async generateForm17Pdf(
    tenantId: string,
    fromDate: string,
    toDate: string,
  ): Promise<Buffer> {
    const entries = await this.getScheduleXEntries(tenantId, fromDate, toDate);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end',  ()      => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth  = doc.page.width  - 60; // minus margins
      const pageHeight = doc.page.height;

      // ── Header ─────────────────────────────────────────────────────────────
      doc.fontSize(14).font('Helvetica-Bold')
        .text('FORM 17', { align: 'center' });
      doc.fontSize(10).font('Helvetica')
        .text('[See Rule 65(11)]', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(11).font('Helvetica-Bold')
        .text('REGISTER OF PURCHASE AND SALE OF NARCOTIC DRUGS AND PSYCHOTROPIC SUBSTANCES', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica')
        .text(`(Schedule X Substances — Drugs & Cosmetics Rules, 1945)`, { align: 'center' });

      doc.moveDown(0.5);

      // Clinic details box
      doc.rect(30, doc.y, pageWidth, 50).stroke();
      const boxY = doc.y + 5;
      doc.fontSize(9).font('Helvetica-Bold').text(CLINIC.name, 35, boxY);
      doc.fontSize(8).font('Helvetica')
        .text(CLINIC.address, 35, boxY + 12, { width: pageWidth * 0.6 });
      doc.text(`Phone: ${CLINIC.phone}  |  GSTIN: ${CLINIC.gstin}`, 35, boxY + 22);
      doc.text(`Drug Licence: ${CLINIC.dl_no}`, 35, boxY + 32);

      const rightX = 30 + pageWidth * 0.65;
      doc.fontSize(8).font('Helvetica-Bold').text('Period:', rightX, boxY);
      doc.font('Helvetica').text(`${fromDate}  to  ${toDate}`, rightX, boxY + 10);
      doc.text(`Total Entries: ${entries.length}`, rightX, boxY + 20);

      doc.moveDown(3.5);

      // ── Table ──────────────────────────────────────────────────────────────
      const colWidths = [35, 65, 80, 160, 60, 40, 110, 110, 80, 100];
      const colHeaders = [
        'S.No', 'Date', 'Bill No', 'Drug Name (Batch)',
        'Qty', 'Unit', 'Patient Name', 'Doctor Name', 'Dr Reg No', 'Dispensed By',
      ];

      const tableTop   = doc.y;
      const rowHeight  = 22;
      let   tableY     = tableTop;
      let   x          = 30;

      // Header row
      doc.rect(x, tableY, pageWidth, rowHeight).fillAndStroke('#00475a', '#00475a');
      colWidths.forEach((w, i) => {
        doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
          .text(colHeaders[i], x + 2, tableY + 5, { width: w - 4, ellipsis: true });
        x += w;
      });
      tableY += rowHeight;

      // Data rows
      doc.fillColor('black');

      if (entries.length === 0) {
        doc.rect(30, tableY, pageWidth, rowHeight).stroke();
        doc.fontSize(8).font('Helvetica')
          .text('No Schedule X (narcotic/psychotropic) dispensing records found for this period.',
            32, tableY + 6, { width: pageWidth });
        tableY += rowHeight;
      }

      entries.forEach((entry, rowIdx) => {
        // New page if needed
        if (tableY + rowHeight > pageHeight - 60) {
          doc.addPage();
          tableY = 30;
          // Repeat header
          x = 30;
          doc.rect(x, tableY, pageWidth, rowHeight).fillAndStroke('#00475a', '#00475a');
          colWidths.forEach((w, i) => {
            doc.fillColor('white').fontSize(7).font('Helvetica-Bold')
              .text(colHeaders[i], x + 2, tableY + 5, { width: w - 4, ellipsis: true });
            x += w;
          });
          tableY += rowHeight;
          doc.fillColor('black');
        }

        const fill = rowIdx % 2 === 0 ? '#F5F7FA' : 'white';
        doc.rect(30, tableY, pageWidth, rowHeight).fillAndStroke(fill, '#CCCCCC');

        x = 30;
        const vals = [
          String(entry.serial_no),
          entry.date,
          entry.bill_number,
          `${entry.medicine_name}\n(Bt: ${entry.batch_number})`,
          String(entry.quantity),
          entry.unit,
          entry.patient_name,
          entry.doctor_name,
          entry.doctor_reg_no || '—',
          entry.pharmacist_name,
        ];

        vals.forEach((val, i) => {
          doc.fillColor('#111').fontSize(7).font('Helvetica')
            .text(val, x + 2, tableY + 4, { width: colWidths[i] - 4, height: rowHeight - 4, ellipsis: true });
          x += colWidths[i];
        });

        tableY += rowHeight;
      });

      // ── Signature block ───────────────────────────────────────────────────
      tableY += 20;
      if (tableY + 60 > pageHeight - 30) {
        doc.addPage();
        tableY = 30;
      }

      doc.fontSize(8).font('Helvetica')
        .text('I certify that the above register is true and correct to the best of my knowledge.',
          30, tableY);
      tableY += 30;

      // Two signature boxes
      doc.rect(30, tableY, 200, 40).stroke();
      doc.text('Signature of Licensed Pharmacist', 35, tableY + 5);
      doc.text('Name: ____________________', 35, tableY + 16);
      doc.text('Reg No: __________________', 35, tableY + 26);

      doc.rect(pageWidth - 140, tableY, 200, 40).stroke();
      doc.text('Signature of Owner/Manager', pageWidth - 135, tableY + 5);
      doc.text('Name: ____________________', pageWidth - 135, tableY + 16);
      doc.text(`Date: ${toDate}`, pageWidth - 135, tableY + 26);

      doc.end();
    });
  }
}
