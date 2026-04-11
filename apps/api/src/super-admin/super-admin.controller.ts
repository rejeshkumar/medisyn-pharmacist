import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  UseGuards, Req, HttpCode, HttpStatus, Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as bcrypt from 'bcrypt';

// ── Super Admin Guard ─────────────────────────────────────────────────────────
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (req.user?.role !== 'super_admin') {
      throw new ForbiddenException('Super admin access required');
    }
    return true;
  }
}

// ── Available Modules Definition ──────────────────────────────────────────────
export const ALL_MODULES = [
  { key: 'patients',      label: 'Patients',           description: 'Patient registration, history, DPDPA consent' },
  { key: 'prescriptions', label: 'Prescriptions',      description: 'AI prescription scanner, doctor module' },
  { key: 'dispensing',    label: 'Dispensing',         description: 'Billing, cart, payment collection' },
  { key: 'procurement',   label: 'Procurement',        description: 'Purchase orders, suppliers, stock receiving' },
  { key: 'reports',       label: 'Reports',            description: '10 standard reports, GST, Schedule H logs' },
  { key: 'hr',            label: 'HR & Attendance',    description: 'Roster, leave, geo-fenced attendance' },
  { key: 'analytics',     label: 'Analytics',          description: 'User behaviour dashboard' },
  { key: 'ai_care',       label: 'AI Care Engine',     description: 'Refill predictions, WhatsApp follow-up' },
];

// ── Plan Module Presets ───────────────────────────────────────────────────────
export const PLAN_PRESETS = {
  doctor_lite:   ['patients', 'prescriptions', 'ai_care'],
  clinic_basic:  ['patients', 'prescriptions', 'dispensing', 'reports'],
  pharmacy_pro:  ['patients', 'prescriptions', 'dispensing', 'procurement', 'reports', 'hr', 'analytics', 'ai_care'],
  trial:         ['patients', 'prescriptions', 'dispensing', 'reports'],
};

// ── Controller ────────────────────────────────────────────────────────────────
@Controller('super-admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class SuperAdminController {
  constructor(@InjectDataSource() private ds: DataSource) {}

  // ── Dashboard Stats ─────────────────────────────────────────────────────────
  @Get('stats')
  async getStats() {
    const [tenants, users, sales, activeToday] = await Promise.all([
      this.ds.query(`SELECT COUNT(*) as count, COUNT(*) FILTER (WHERE is_active) as active FROM tenants WHERE id != '00000000-0000-0000-0000-000000000000'`),
      this.ds.query(`SELECT COUNT(*) as count FROM users WHERE role != 'super_admin'`),
      this.ds.query(`SELECT COUNT(*) as count, COALESCE(SUM(total_amount),0) as revenue FROM sales WHERE created_at > NOW() - INTERVAL '30 days'`),
      this.ds.query(`SELECT COUNT(DISTINCT tenant_id) as count FROM sales WHERE created_at > NOW() - INTERVAL '1 day'`),
    ]);
    return {
      tenants:      { total: +tenants[0].count, active: +tenants[0].active },
      users:        { total: +users[0].count },
      last30days:   { bills: +sales[0].count, revenue: +sales[0].revenue },
      activeToday:  { tenants: +activeToday[0].count },
    };
  }

  // ── Module Definitions ──────────────────────────────────────────────────────
  @Get('modules')
  getModules() {
    return { modules: ALL_MODULES, presets: PLAN_PRESETS };
  }

  // ── Tenants CRUD ────────────────────────────────────────────────────────────
  @Get('tenants')
  async getTenants(@Query('search') search?: string) {
    const where = search
      ? `AND (t.name ILIKE $1 OR t.slug ILIKE $1)` : '';
    const params = search ? [`%${search}%`] : [];
    return this.ds.query(
      `SELECT t.*,
         COUNT(DISTINCT u.id) as user_count,
         COUNT(DISTINCT s.id) FILTER (WHERE s.created_at > NOW() - INTERVAL '30 days') as bills_last_30d
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id AND u.role != 'super_admin'
       LEFT JOIN sales s ON s.tenant_id = t.id
       WHERE t.id != '00000000-0000-0000-0000-000000000000' ${where}
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      params,
    );
  }

  @Get('tenants/:id')
  async getTenant(@Param('id') id: string) {
    const [tenant] = await this.ds.query(
      `SELECT t.*, COUNT(DISTINCT u.id) as user_count
       FROM tenants t
       LEFT JOIN users u ON u.tenant_id = t.id
       WHERE t.id = $1 GROUP BY t.id`, [id]
    );
    if (!tenant) throw new ForbiddenException('Tenant not found');
    const users = await this.ds.query(
      `SELECT id, full_name, mobile, role, status, created_at FROM users WHERE tenant_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    return { ...tenant, users };
  }

  @Post('tenants')
  async createTenant(@Body() dto: {
    name: string; slug: string; phone?: string; email?: string;
    address?: string; city?: string; state?: string;
    gstin?: string; license_no?: string; logo_url?: string;
    tagline?: string; primary_color?: string; website?: string;
    plan: string; mode: string; modules: string[];
    trial_ends_at?: string;
    // First owner user
    owner_name: string; owner_mobile: string; owner_password: string;
  }) {
    // Validate slug uniqueness
    const existing = await this.ds.query(
      `SELECT id FROM tenants WHERE slug = $1`, [dto.slug]
    );
    if (existing.length) throw new ForbiddenException('Slug already taken');

    const tenantId = await this.ds.query(`SELECT gen_random_uuid() as id`);
    const id = tenantId[0].id;

    // Create tenant
    await this.ds.query(
      `INSERT INTO tenants (
         id, name, slug, phone, email, address, city, state,
         gstin, license_no, logo_url, tagline, primary_color, website,
         plan, mode, modules, is_active, trial_ends_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,true,$18)`,
      [
        id, dto.name, dto.slug, dto.phone || null, dto.email || null,
        dto.address || null, dto.city || null, dto.state || 'Kerala',
        dto.gstin || null, dto.license_no || null, dto.logo_url || null,
        dto.tagline || null, dto.primary_color || '#00475a', dto.website || null,
        dto.plan, dto.mode, JSON.stringify(dto.modules),
        dto.trial_ends_at || null,
      ]
    );

    // Create owner user
    const hash = await bcrypt.hash(dto.owner_password, 12);
    await this.ds.query(
      `INSERT INTO users (id, tenant_id, full_name, mobile, role, status, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, 'owner', 'active', $4)`,
      [id, dto.owner_name, dto.owner_mobile, hash]
    );

    return { success: true, tenant_id: id, message: `Tenant "${dto.name}" created successfully` };
  }

  @Patch('tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() dto: {
    name?: string; phone?: string; email?: string; address?: string;
    city?: string; state?: string; gstin?: string; license_no?: string;
    logo_url?: string; tagline?: string; primary_color?: string; website?: string;
    plan?: string; mode?: string; modules?: string[];
    is_active?: boolean; trial_ends_at?: string;
  }) {
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;

    if (dto.name !== undefined)          { fields.push(`name=$${i++}`);          values.push(dto.name); }
    if (dto.phone !== undefined)         { fields.push(`phone=$${i++}`);         values.push(dto.phone); }
    if (dto.email !== undefined)         { fields.push(`email=$${i++}`);         values.push(dto.email); }
    if (dto.address !== undefined)       { fields.push(`address=$${i++}`);       values.push(dto.address); }
    if (dto.city !== undefined)          { fields.push(`city=$${i++}`);          values.push(dto.city); }
    if (dto.state !== undefined)         { fields.push(`state=$${i++}`);         values.push(dto.state); }
    if (dto.gstin !== undefined)         { fields.push(`gstin=$${i++}`);         values.push(dto.gstin); }
    if (dto.license_no !== undefined)    { fields.push(`license_no=$${i++}`);    values.push(dto.license_no); }
    if (dto.logo_url !== undefined)      { fields.push(`logo_url=$${i++}`);      values.push(dto.logo_url); }
    if (dto.tagline !== undefined)       { fields.push(`tagline=$${i++}`);       values.push(dto.tagline); }
    if (dto.primary_color !== undefined) { fields.push(`primary_color=$${i++}`); values.push(dto.primary_color); }
    if (dto.website !== undefined)       { fields.push(`website=$${i++}`);       values.push(dto.website); }
    if (dto.plan !== undefined)          { fields.push(`plan=$${i++}`);          values.push(dto.plan); }
    if (dto.mode !== undefined)          { fields.push(`mode=$${i++}`);          values.push(dto.mode); }
    if (dto.modules !== undefined)       { fields.push(`modules=$${i++}`);       values.push(JSON.stringify(dto.modules)); }
    if (dto.is_active !== undefined)     { fields.push(`is_active=$${i++}`);     values.push(dto.is_active); }
    if (dto.trial_ends_at !== undefined) { fields.push(`trial_ends_at=$${i++}`); values.push(dto.trial_ends_at); }

    if (!fields.length) return { success: true, message: 'Nothing to update' };

    values.push(id);
    await this.ds.query(
      `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${i}`, values
    );
    return { success: true, message: 'Tenant updated' };
  }

  @Patch('tenants/:id/toggle')
  async toggleTenant(@Param('id') id: string) {
    await this.ds.query(
      `UPDATE tenants SET is_active = NOT is_active WHERE id = $1`, [id]
    );
    const [t] = await this.ds.query(`SELECT is_active FROM tenants WHERE id = $1`, [id]);
    return { success: true, is_active: t.is_active };
  }

  // ── User Management ─────────────────────────────────────────────────────────
  @Post('tenants/:id/users')
  async addUser(@Param('id') tenantId: string, @Body() dto: {
    full_name: string; mobile: string; role: string; password: string;
  }) {
    const hash = await bcrypt.hash(dto.password, 12);
    await this.ds.query(
      `INSERT INTO users (id, tenant_id, full_name, mobile, role, status, password_hash)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'active', $5)`,
      [tenantId, dto.full_name, dto.mobile, dto.role, hash]
    );
    return { success: true, message: `User ${dto.full_name} added` };
  }

  @Patch('tenants/:tenantId/users/:userId')
  async updateUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: { full_name?: string; role?: string; status?: string; password?: string }
  ) {
    if (dto.password) {
      const hash = await bcrypt.hash(dto.password, 12);
      await this.ds.query(
        `UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2 AND tenant_id=$3`,
        [hash, userId, tenantId]
      );
    }
    const fields: string[] = [];
    const values: any[] = [];
    let i = 1;
    if (dto.full_name) { fields.push(`full_name=$${i++}`); values.push(dto.full_name); }
    if (dto.role)      { fields.push(`role=$${i++}`);      values.push(dto.role); }
    if (dto.status)    { fields.push(`status=$${i++}`);    values.push(dto.status); }
    if (fields.length) {
      values.push(userId, tenantId);
      await this.ds.query(
        `UPDATE users SET ${fields.join(', ')}, updated_at=NOW() WHERE id=$${i++} AND tenant_id=$${i}`,
        values
      );
    }
    return { success: true };
  }

  // ── Audit Log ───────────────────────────────────────────────────────────────
  @Get('audit')
  async getAuditLog(
    @Query('tenant_id') tenantId?: string,
    @Query('limit') limit = '50'
  ) {
    const where = tenantId ? `WHERE al.tenant_id = $2` : '';
    const params = tenantId ? [+limit, tenantId] : [+limit];
    return this.ds.query(
      `SELECT al.*, t.name as tenant_name
       FROM audit_logs al
       LEFT JOIN tenants t ON al.tenant_id = t.id
       ${where}
       ORDER BY al.created_at DESC LIMIT $1`,
      params
    );
  }
}
