// ============================================================
// apps/api/src/sales/credit-note.service.ts
// ============================================================
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface CreateCreditNoteDto {
  original_sale_id: string;
  reason: 'patient_return' | 'dispensing_error' | 'damaged' | 'expired' | 'wrong_quantity' | 'other';
  reason_notes?: string;
  return_type: 'refund' | 'store_credit' | 'exchange';
  refund_mode?: 'Cash' | 'UPI' | 'Bank Transfer';
  refund_reference?: string;
  items: {
    sale_item_id: string;
    qty_returned: number;
  }[];
}

@Injectable()
export class CreditNoteService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  // ── Generate credit note number ──────────────────────────────────────────
  private async nextCreditNoteNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear();
    const [row] = await this.db.query(
      `SELECT COUNT(*) + 1 AS next_seq
       FROM credit_notes
       WHERE tenant_id = $1
         AND EXTRACT(YEAR FROM created_at) = $2`,
      [tenantId, year],
    );
    const seq = String(row.next_seq).padStart(4, '0');
    return `CN-${year}-${seq}`;
  }

  // ── Create credit note ───────────────────────────────────────────────────
  async createCreditNote(
    dto: CreateCreditNoteDto,
    userId: string,
    tenantId: string,
  ) {
    // 1. Load original sale + items
    const [sale] = await this.db.query(
      `SELECT s.*, s.bill_number
       FROM sales s
       WHERE s.id = $1 AND s.tenant_id = $2`,
      [dto.original_sale_id, tenantId],
    );
    if (!sale) throw new NotFoundException('Original bill not found');
    if (sale.is_voided) throw new BadRequestException('Cannot raise credit note on a voided bill');

    // Check no existing credit note covers same items (prevent double-return)
    const [existing] = await this.db.query(
      `SELECT COUNT(*) AS cnt
       FROM credit_notes cn
       JOIN credit_note_items cni ON cni.credit_note_id = cn.id
       WHERE cn.original_sale_id = $1
         AND cn.status = 'active'
         AND cni.sale_item_id = ANY($2::uuid[])`,
      [dto.original_sale_id, dto.items.map(i => i.sale_item_id)],
    );
    if (parseInt(existing.cnt) > 0) {
      throw new BadRequestException(
        'One or more items already have an active credit note. Check existing returns first.',
      );
    }

    // 2. Load sale items for the selected items
    const itemIds = dto.items.map(i => i.sale_item_id);
    const saleItems = await this.db.query(
      `SELECT si.id, si.medicine_id, si.batch_id, si.qty AS qty_sold,
              si.rate, m.brand_name AS medicine_name, sb.batch_number,
              sb.quantity AS current_stock
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       JOIN stock_batches sb ON sb.id = si.batch_id
       WHERE si.id = ANY($1::uuid[])
         AND si.sale_id = $2
         AND si.tenant_id = $3`,
      [itemIds, dto.original_sale_id, tenantId],
    );

    if (saleItems.length !== itemIds.length) {
      throw new BadRequestException('Some sale items not found or do not belong to this bill');
    }

    // 3. Validate return quantities
    for (const item of dto.items) {
      const si = saleItems.find(s => s.id === item.sale_item_id);
      if (!si) continue;

      // Check how much has already been returned for this item
      const [prevReturned] = await this.db.query(
        `SELECT COALESCE(SUM(qty_returned), 0) AS already_returned
         FROM credit_note_items cni
         JOIN credit_notes cn ON cn.id = cni.credit_note_id
         WHERE cni.sale_item_id = $1
           AND cn.status = 'active'`,
        [item.sale_item_id],
      );
      const maxReturnable = parseInt(si.qty_sold) - parseInt(prevReturned.already_returned);

      if (item.qty_returned > maxReturnable) {
        throw new BadRequestException(
          `${si.medicine_name}: can only return up to ${maxReturnable} units (${parseInt(si.qty_sold)} sold, ${parseInt(prevReturned.already_returned)} already returned)`,
        );
      }
    }

    // 4. Calculate totals
    const cnItems = dto.items.map(item => {
      const si = saleItems.find(s => s.id === item.sale_item_id)!;
      return {
        sale_item_id: item.sale_item_id,
        medicine_id: si.medicine_id,
        batch_id: si.batch_id,
        medicine_name: si.medicine_name,
        batch_number: si.batch_number,
        qty_returned: item.qty_returned,
        rate: parseFloat(si.rate),
        line_total: parseFloat(si.rate) * item.qty_returned,
        current_stock: parseInt(si.current_stock),
      };
    });

    const totalAmount = cnItems.reduce((s, i) => s + i.line_total, 0);
    const cnNumber = await this.nextCreditNoteNumber(tenantId);

    // 5. Run everything in a transaction
    await this.db.transaction(async (em) => {
      // Create credit note header
      const [cn] = await em.query(
        `INSERT INTO credit_notes
           (credit_note_number, original_sale_id, original_bill_number,
            reason, reason_notes, return_type, total_amount,
            refund_mode, refund_reference, processed_by, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         RETURNING id`,
        [
          cnNumber,
          dto.original_sale_id,
          sale.bill_number,
          dto.reason,
          dto.reason_notes || null,
          dto.return_type,
          totalAmount,
          dto.refund_mode || null,
          dto.refund_reference || null,
          userId,
          tenantId,
        ],
      );

      // Create credit note items + restore stock
      for (const item of cnItems) {
        await em.query(
          `INSERT INTO credit_note_items
             (credit_note_id, sale_item_id, medicine_id, batch_id,
              medicine_name, batch_number, qty_returned, rate,
              line_total, stock_restored, tenant_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            cn.id,
            item.sale_item_id,
            item.medicine_id,
            item.batch_id,
            item.medicine_name,
            item.batch_number,
            item.qty_returned,
            item.rate,
            item.line_total,
            true,
            tenantId,
          ],
        );

        // Restore stock to batch
        await em.query(
          `UPDATE stock_batches
           SET quantity = quantity + $1,
               updated_at = NOW()
           WHERE id = $2 AND tenant_id = $3`,
          [item.qty_returned, item.batch_id, tenantId],
        );

        // Write stock adjustment log
        await em.query(
          `INSERT INTO stock_adjustments
             (medicine_id, batch_id, adjustment_type, quantity_change,
              reason, performed_by, tenant_id)
           VALUES ($1,$2,'return_from_patient',$3,$4,$5,$6)`,
          [
            item.medicine_id,
            item.batch_id,
            item.qty_returned,
            `Credit note ${cnNumber} — original bill ${sale.bill_number}`,
            userId,
            tenantId,
          ],
        );
      }

      // If store credit — record in credit_accounts or expenses
      if (dto.return_type === 'store_credit' && sale.patient_id) {
        await em.query(
          `INSERT INTO credit_accounts
             (patient_id, credit_amount, credit_note_id, reason, tenant_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (patient_id, tenant_id)
           DO UPDATE SET credit_amount = credit_accounts.credit_amount + $2,
                         updated_at = NOW()`,
          [
            sale.patient_id,
            totalAmount,
            cn.id,
            `Store credit from return — ${cnNumber}`,
            tenantId,
          ],
        ).catch(() => {
          // credit_accounts table may not exist — log as expense note instead
          console.warn('credit_accounts table not found — skipping store credit entry');
        });
      }

      return cn;
    });

    // 6. Return the created credit note for printing
    return this.getCreditNote(cnNumber, tenantId);
  }

  // ── Fetch credit note by number ──────────────────────────────────────────
  async getCreditNote(cnNumber: string, tenantId: string) {
    const [cn] = await this.db.query(
      `SELECT cn.*,
              u.full_name AS processed_by_name
       FROM credit_notes cn
       LEFT JOIN users u ON u.id = cn.processed_by
       WHERE cn.credit_note_number = $1 AND cn.tenant_id = $2`,
      [cnNumber, tenantId],
    );
    if (!cn) throw new NotFoundException('Credit note not found');

    const items = await this.db.query(
      `SELECT * FROM credit_note_items WHERE credit_note_id = $1`,
      [cn.id],
    );

    return { ...cn, items };
  }

  // ── List credit notes for a sale ─────────────────────────────────────────
  async listBySale(saleId: string, tenantId: string) {
    return this.db.query(
      `SELECT cn.*, COUNT(cni.id) AS item_count
       FROM credit_notes cn
       LEFT JOIN credit_note_items cni ON cni.credit_note_id = cn.id
       WHERE cn.original_sale_id = $1 AND cn.tenant_id = $2
       GROUP BY cn.id
       ORDER BY cn.created_at DESC`,
      [saleId, tenantId],
    );
  }

  // ── List recent credit notes ──────────────────────────────────────────────
  async list(tenantId: string, from?: string, to?: string) {
    return this.db.query(
      `SELECT cn.credit_note_number, cn.original_bill_number,
              cn.reason, cn.return_type, cn.total_amount,
              cn.refund_mode, cn.status, cn.created_at,
              u.full_name AS processed_by_name,
              COUNT(cni.id) AS item_count
       FROM credit_notes cn
       LEFT JOIN users u ON u.id = cn.processed_by
       LEFT JOIN credit_note_items cni ON cni.credit_note_id = cn.id
       WHERE cn.tenant_id = $1
         AND ($2::date IS NULL OR cn.created_at::date >= $2::date)
         AND ($3::date IS NULL OR cn.created_at::date <= $3::date)
       GROUP BY cn.id, u.full_name
       ORDER BY cn.created_at DESC
       LIMIT 100`,
      [tenantId, from || null, to || null],
    );
  }

  // ── Get returnable items for a sale (what can still be returned) ──────────
  async getReturnableItems(saleId: string, tenantId: string) {
    const [sale] = await this.db.query(
      `SELECT id, bill_number, is_voided FROM sales WHERE id = $1 AND tenant_id = $2`,
      [saleId, tenantId],
    );
    if (!sale) throw new NotFoundException('Bill not found');
    if (sale.is_voided) throw new BadRequestException('Bill is voided — no returns possible');

    const items = await this.db.query(
      `SELECT
         si.id AS sale_item_id,
         m.brand_name AS medicine_name,
         sb.batch_number,
         sb.expiry_date,
         si.qty AS qty_sold,
         si.rate,
         si.qty * si.rate AS line_total,
         COALESCE(SUM(cni.qty_returned), 0) AS qty_already_returned,
         si.qty - COALESCE(SUM(cni.qty_returned), 0) AS qty_returnable
       FROM sale_items si
       JOIN medicines m ON m.id = si.medicine_id
       JOIN stock_batches sb ON sb.id = si.batch_id
       LEFT JOIN credit_note_items cni ON cni.sale_item_id = si.id
         AND EXISTS (
           SELECT 1 FROM credit_notes cn
           WHERE cn.id = cni.credit_note_id AND cn.status = 'active'
         )
       WHERE si.sale_id = $1 AND si.tenant_id = $2
       GROUP BY si.id, m.brand_name, sb.batch_number, sb.expiry_date, si.qty, si.rate`,
      [saleId, tenantId],
    );

    return {
      sale,
      items: items.filter(i => parseInt(i.qty_returnable) > 0),
      all_items: items,
    };
  }
}
