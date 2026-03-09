import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, UserStatus } from '../database/entities/user.entity';
import { Tenant, TenantMode, TenantPlan } from '../database/entities/tenant.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Tenant)
    private tenantsRepo: Repository<Tenant>,
    private jwtService: JwtService,
  ) {}

  async login(mobile: string, password: string) {
    const user = await this.usersRepo.findOne({
      where: { mobile },
      relations: ['tenant'],
    });

    if (!user) throw new UnauthorizedException('Invalid credentials');

    if (user.status === UserStatus.INACTIVE)
      throw new UnauthorizedException('Account is deactivated. Contact admin.');

    if (!user.tenant_id || !user.tenant)
      throw new UnauthorizedException('Account configuration error. Contact admin.');

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    // JWT now carries tenant context — this is what TenantGuard reads
    const payload = {
      sub:         user.id,
      role:        user.role,
      name:        user.full_name,
      tenant_id:   user.tenant_id,
      tenant_mode: user.tenant.mode,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id:          user.id,
        full_name:   user.full_name,
        mobile:      user.mobile,
        role:        user.role,
        tenant_id:   user.tenant_id,
        tenant_mode: user.tenant.mode,
      },
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['tenant'],
    });
    if (!user || user.status === UserStatus.INACTIVE) return null;
    return user;
  }

  async seedOwner() {
    // Ensure Tenant #1 exists first
    let tenant = await this.tenantsRepo.findOne({
      where: { id: '00000000-0000-0000-0000-000000000001' },
    });

    if (!tenant) {
      tenant = await this.tenantsRepo.save(
        this.tenantsRepo.create({
          id:        '00000000-0000-0000-0000-000000000001',
          name:      'MediSyn Specialty Clinic',
          slug:      'medisyn-specialty',
          mode:      TenantMode.FULL,
          plan:      TenantPlan.PRO,
          is_active: true,
        }),
      );
      console.log('✅ Default tenant seeded: MediSyn Specialty Clinic');
    }

    // Ensure default owner exists
    const existing = await this.usersRepo.findOne({
      where: { mobile: '9999999999' },
    });

    if (!existing) {
      const hash = await bcrypt.hash('admin123', 10);
      await this.usersRepo.save(
        this.usersRepo.create({
          full_name:     'Admin Owner',
          mobile:        '9999999999',
          password_hash: hash,
          role:          UserRole.OWNER,
          tenant_id:     tenant.id,
        }),
      );
      console.log('✅ Default owner seeded: mobile=9999999999, password=admin123');
    } else if (!existing.tenant_id) {
      // Existing owner missing tenant_id — fix it
      await this.usersRepo.update(existing.id, { tenant_id: tenant.id });
      console.log('✅ Default owner tenant_id backfilled');
    }
  }
}
