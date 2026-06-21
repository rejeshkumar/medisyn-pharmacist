// ============================================================
// ADD TO: apps/api/src/medicines/medicines.controller.ts
// ============================================================
// POST /medicines/scan-barcode
// Looks up medicine by GTIN and optionally matches specific batch
// ============================================================

// ── In medicines.service.ts — add this method ────────────────────────────────

/*
  async scanBarcode(dto: {
    gtin?: string;
    gtin13?: string;
    batch_number?: string;
    expiry_date?: string;
    raw: string;
    barcode_type: string;
  }, tenantId: string) {

    const gtin = dto.gtin13 || (dto.gtin?.startsWith('0') ? dto.gtin.substring(1) : dto.gtin);
    if (!gtin) return { medicine: null, batch: null, confidence: 'not_found' };

    // Step 1: Look up medicine by GTIN in barcode_mappings table
    let medicine = null;
    const mapping = await this.dataSource.query(`
      SELECT m.* FROM medicines m
      JOIN barcode_mappings bm ON bm.medicine_id = m.id
      WHERE bm.barcode = $1 AND m.tenant_id = $2
      LIMIT 1
    `, [gtin, tenantId]).catch(() => []);

    if (mapping.length > 0) {
      medicine = mapping[0];
    } else {
      // Step 2: Fuzzy match by GTIN in medicine_reference table
      const ref = await this.dataSource.query(`
        SELECT m.* FROM medicines m
        WHERE m.tenant_id = $1
        AND m.hsn_code IS NOT NULL
        LIMIT 1
      `, [tenantId]).catch(() => []);
      // No match — medicine not yet mapped
    }

    if (!medicine) {
      return { medicine: null, batch: null, confidence: 'not_found', gtin };
    }

    // Step 3: Find matching batch
    let batch = null;
    let confidence = 'fefo_batch';

    if (dto.batch_number) {
      // Try exact batch match first
      const exactBatch = await this.dataSource.query(`
        SELECT * FROM stock_batches
        WHERE medicine_id = $1
          AND UPPER(TRIM(batch_number)) = UPPER(TRIM($2))
          AND tenant_id = $3
          AND quantity > 0
          AND is_active = true
        LIMIT 1
      `, [medicine.id, dto.batch_number, tenantId]);

      if (exactBatch.length > 0) {
        batch = exactBatch[0];
        confidence = 'exact_batch';
      }
    }

    // Fallback to FEFO batch
    if (!batch) {
      const fefoBatch = await this.dataSource.query(`
        SELECT * FROM stock_batches
        WHERE medicine_id = $1
          AND tenant_id = $2
          AND quantity > 0
          AND is_active = true
        ORDER BY expiry_date ASC
        LIMIT 1
      `, [medicine.id, tenantId]);

      if (fefoBatch.length > 0) {
        batch = fefoBatch[0];
      }
    }

    // Step 4: Auto-save GTIN mapping if not already mapped
    if (mapping.length === 0 && medicine && gtin) {
      await this.dataSource.query(`
        INSERT INTO barcode_mappings (gtin, medicine_id, tenant_id, source, created_at)
        VALUES ($1, $2, $3, 'auto_scan', NOW())
        ON CONFLICT (gtin, tenant_id) DO NOTHING
      `, [gtin, medicine.id, tenantId]).catch(() => {});
    }

    return { medicine, batch, confidence, gtin };
  }
*/

// ── Full controller endpoint ──────────────────────────────────────────────────

import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('medicines')
@UseGuards(JwtAuthGuard)
export class BarcodeScanController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Post('scan-barcode')
  async scanBarcode(
    @Body() dto: {
      gtin?: string;
      gtin13?: string;
      batch_number?: string;
      expiry_date?: string;
      raw: string;
      barcode_type: string;
    },
    @Req() req: any,
  ) {
    const tenantId = req.user.tenant_id;
    const gtin = dto.gtin13 ||
      (dto.gtin?.startsWith('0') ? dto.gtin.substring(1) : dto.gtin);

    if (!gtin) return { medicine: null, batch: null, confidence: 'not_found' };

    // Step 1: Look up medicine by GTIN mapping
    const mapping = await this.ds.query(`
      SELECT m.*
      FROM medicines m
      JOIN barcode_mappings bm ON bm.medicine_id = m.id
      WHERE bm.gtin = $1 AND m.tenant_id = $2
      LIMIT 1
    `, [gtin, tenantId]).catch(() => []);

    let medicine = mapping[0] || null;

    if (!medicine) {
      return {
        medicine:   null,
        batch:      null,
        confidence: 'not_found',
        gtin,
        message:    'Medicine not mapped. Scan and map this barcode first.',
      };
    }

    // Step 2: Find matching batch
    let batch = null;
    let confidence = 'fefo_batch';

    if (dto.batch_number) {
      const exact = await this.ds.query(`
        SELECT * FROM stock_batches
        WHERE medicine_id = $1
          AND UPPER(TRIM(batch_number)) = UPPER(TRIM($2))
          AND tenant_id = $3
          AND quantity > 0
          AND is_active = true
        LIMIT 1
      `, [medicine.id, dto.batch_number, tenantId]);

      if (exact.length > 0) {
        batch      = exact[0];
        confidence = 'exact_batch';
      }
    }

    if (!batch) {
      const fefo = await this.ds.query(`
        SELECT * FROM stock_batches
        WHERE medicine_id = $1
          AND tenant_id = $2
          AND quantity > 0
          AND is_active = true
        ORDER BY expiry_date ASC
        LIMIT 1
      `, [medicine.id, tenantId]);

      batch = fefo[0] || null;
    }

    // Step 3: Auto-learn GTIN mapping
    await this.ds.query(`
      INSERT INTO barcode_mappings (barcode, medicine_id, tenant_id, created_by, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (tenant_id, barcode) DO NOTHING
    `, [gtin, medicine.id, tenantId, req.user.sub]).catch(() => {});

    return { medicine, batch, confidence, gtin };
  }
}
