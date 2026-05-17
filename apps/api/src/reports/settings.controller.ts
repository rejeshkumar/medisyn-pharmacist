import { Controller, Get, Patch, Body, Req, Param, UseGuards } from '@nestjs/common';
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


  // ══════════════════════════════════════════════════════════
  // DOCTOR PROFILE MANAGEMENT
  // ══════════════════════════════════════════════════════════

  @Get('doctor-profiles')
  async getDoctorProfiles(@Req() req: any) {
    return this.ds.query(
      `SELECT id, full_name, qualification, registration_no, designation, role, is_active
       FROM users
       WHERE tenant_id = $1 AND role = 'doctor'
       ORDER BY full_name`,
      [req.user.tenant_id],
    );
  }

  @Patch('doctor-profiles/:id')
  async updateDoctorProfile(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const f of ['qualification', 'registration_no', 'designation', 'full_name']) {
      if (body[f] !== undefined) {
        fields.push(`${f} = $${idx}`);
        params.push(body[f]);
        idx++;
      }
    }
    if (fields.length === 0) return { message: 'Nothing to update' };
    fields.push('updated_at = NOW()');
    params.push(id);
    params.push(req.user.tenant_id);
    await this.ds.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} AND tenant_id = $${idx + 1}`,
      params,
    );
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════
  // CLINIC PROFILE (letterhead)
  // ══════════════════════════════════════════════════════════

  @Get('clinic-profile')
  async getClinicProfile(@Req() req: any) {
    const [row] = await this.ds.query(
      `SELECT name, address, phone, email, logo_url, gstin, license_no,
              clinic_address, clinic_phone, clinic_email, website, city, state
       FROM tenants WHERE id = $1`,
      [req.user.tenant_id],
    );
    return row || {};
  }

  @Patch('clinic-profile')
  async updateClinicProfile(@Body() body: any, @Req() req: any) {
    const fields: string[] = [];
    const params: any[] = [];
    let idx = 1;
    for (const f of ['clinic_address', 'clinic_phone', 'clinic_email', 'address', 'phone', 'email', 'website', 'city', 'state', 'gstin', 'license_no']) {
      if (body[f] !== undefined) {
        fields.push(`${f} = $${idx}`);
        params.push(body[f]);
        idx++;
      }
    }
    if (fields.length === 0) return { message: 'Nothing to update' };
    fields.push('updated_at = NOW()');
    params.push(req.user.tenant_id);
    await this.ds.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${idx}`,
      params,
    );
    return { success: true };
  }



  @Get('reorder-settings')
  async getReorderSettings(@Req() req: any) {
    const row = await this.ds.query(
      `SELECT settings FROM tenants WHERE id = $1`,
      [req.user.tenant_id]
    );
    const settings = row[0]?.settings || {};
    return {
      reorder_cover_days:      settings.reorder_cover_days      ?? 14,
      reorder_qty_days:        settings.reorder_qty_days        ?? 7,
      suggested_qty_days:      settings.suggested_qty_days      ?? 30,
      fallback_min_stock:      settings.fallback_min_stock      ?? 10,
      fallback_suggested_qty:  settings.fallback_suggested_qty  ?? 20,
    };
  }

  @Patch('reorder-settings')
  async updateReorderSettings(@Body() body: any, @Req() req: any) {
    const allowed = ['reorder_cover_days','reorder_qty_days','suggested_qty_days','fallback_min_stock','fallback_suggested_qty'];
    const update: any = {};
    for (const key of allowed) {
      if (body[key] !== undefined) update[key] = Number(body[key]);
    }
    await this.ds.query(
      `UPDATE tenants SET settings = COALESCE(settings, '{}') || $1::jsonb WHERE id = $2`,
      [JSON.stringify(update), req.user.tenant_id]
    );
    return { success: true };
  }
}