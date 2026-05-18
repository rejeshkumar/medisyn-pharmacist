import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DataSource } from 'typeorm';

@ApiTags('Finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private dataSource: DataSource) {}

  @Get('vendors-with-pending-payments')
  async getVendorsWithPendingPayments(@Req() req) {
    const tenantId = req.user.tenant_id;

    // Simple SQL query - no complex entities needed
    const vendors = await this.dataSource.query(`
      SELECT 
        pp.supplier_id,
        COALESCE(s.name, pp.vendor_name) as supplier_name,
        COUNT(DISTINCT pp.po_id) as pending_po_count,
        SUM(pp.pending_amount) as total_pending,
        MIN(po.payment_due_date) as oldest_due_date,
        CASE 
          WHEN MIN(po.payment_due_date) < CURRENT_DATE THEN true 
          ELSE false 
        END as is_overdue
      FROM pharmacy_purchases pp
      LEFT JOIN suppliers s ON s.id = pp.supplier_id
      LEFT JOIN purchase_orders po ON po.id = pp.po_id
      WHERE pp.tenant_id = $1
        AND pp.payment_status IN ('unpaid', 'partial')
        AND pp.pending_amount > 0
      GROUP BY pp.supplier_id, s.name, pp.vendor_name
      ORDER BY is_overdue DESC, total_pending DESC
    `, [tenantId]);

    return vendors;
  }
}
