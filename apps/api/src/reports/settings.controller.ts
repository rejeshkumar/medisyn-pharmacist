import { Controller, Get, Patch, Body, Req, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';

@Controller('settings')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SettingsController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  @Get('expiry-threshold')
  async getExpiryThreshold(@Req() req: any) {
    const rows = await this.ds.query(
      `SELECT expiry_warning_days FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    return { expiry_warning_days: rows[0]?.expiry_warning_days ?? 60 };
  }

  @Patch('expiry-threshold')
  async setExpiryThreshold(@Req() req: any, @Body() body: { expiry_warning_days: number }) {
    const days = Math.min(365, Math.max(1, Number(body.expiry_warning_days) || 60));
    await this.ds.query(
      `UPDATE tenants SET expiry_warning_days = $1, updated_at = NOW() WHERE id = $2`,
      [days, req.user.tenant_id]
    );
    return { expiry_warning_days: days };
  }
}
