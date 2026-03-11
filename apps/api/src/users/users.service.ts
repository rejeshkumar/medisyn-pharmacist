import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserStatus } from '../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../database/entities/audit-log.entity';
import { UserContext } from '../sales/sales.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private auditService: AuditService,
  ) {}

  async findAll(tenantId: string, role?: string) {
    if (role) {
      // Match users whose primary role OR multi-role array includes the requested role
      return this.usersRepo
        .createQueryBuilder('u')
        .where('u.tenant_id = :tenantId', { tenantId })
        .andWhere('u.status = :status', { status: 'active' })
        .andWhere('(u.role = :role OR :role = ANY(u.roles))', { role })
        .orderBy('u.full_name', 'ASC')
        .getMany();
    }
    return this.usersRepo.find({
      where: { tenant_id: tenantId },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string) {
    const user = await this.usersRepo.findOne({ where: { id, tenant_id: tenantId } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(dto: CreateUserDto, actor: UserContext) {
    const { id: actorId, tenant_id: tenantId } = actor;

    const existing = await this.usersRepo.findOne({
      where: { mobile: dto.mobile, tenant_id: tenantId },
    });
    if (existing) throw new ConflictException('Mobile number already registered');

    const hash = await bcrypt.hash(dto.password, 10);
    const roles: string[] = dto.roles?.length ? dto.roles : [dto.role];
    const primaryRole = roles[0] as any;

    const user = this.usersRepo.create({
      full_name:     dto.full_name,
      mobile:        dto.mobile,
      password_hash: hash,
      role:          primaryRole,
      roles:         roles,
      tenant_id:     tenantId,
      created_by:    actorId,
    });
    const saved = await this.usersRepo.save(user);

    await this.auditService.log({
      tenantId,
      userId:    actorId,
      userName:  actor.full_name,
      userRole:  actor.role,
      action:    AuditAction.CREATE,
      entity:    'User',
      entityId:  saved.id,
      entityRef: `${saved.full_name} (${roles.join(', ')})`,
      newValue:  { full_name: saved.full_name, roles, mobile: saved.mobile },
    });

    return saved;
  }

  async update(id: string, dto: UpdateUserDto, actor: UserContext) {
    const { id: actorId, tenant_id: tenantId } = actor;
    const user = await this.findOne(id, tenantId);

    // Snapshot before
    const oldRoles = (user as any).roles?.length ? (user as any).roles : [user.role];
    const oldValue: Record<string, any> = {
      full_name: user.full_name,
      mobile:    user.mobile,
      role:      user.role,
      roles:     oldRoles,
    };

    if (dto.password) {
      (dto as any).password_hash = await bcrypt.hash(dto.password, 10);
      delete dto.password;
    }

    // Handle roles array update
    if (dto.roles?.length) {
      (user as any).roles = dto.roles;
      user.role = dto.roles[0] as any;
    } else if (dto.role) {
      user.role = dto.role;
      (user as any).roles = [dto.role];
    }

    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.mobile)    user.mobile    = dto.mobile;
    if ((dto as any).password_hash) user.password_hash = (dto as any).password_hash;

    user.updated_by = actorId;
    const saved = await this.usersRepo.save(user);

    // Build newValue snapshot
    const newRoles = (saved as any).roles?.length ? (saved as any).roles : [saved.role];
    const newValue: Record<string, any> = {
      full_name: saved.full_name,
      mobile:    saved.mobile,
      role:      saved.role,
      roles:     newRoles,
    };

    // Detect what changed for a clear audit description
    const changes: string[] = [];
    if (oldValue.full_name !== newValue.full_name) changes.push('name');
    if (oldValue.mobile !== newValue.mobile)       changes.push('mobile');
    if (JSON.stringify(oldValue.roles.sort()) !== JSON.stringify(newRoles.sort())) {
      changes.push(`roles: [${oldRoles.join(', ')}] → [${newRoles.join(', ')}]`);
    }

    await this.auditService.log({
      tenantId,
      userId:    actorId,
      userName:  actor.full_name,
      userRole:  actor.role,
      action:    AuditAction.UPDATE,
      entity:    'User',
      entityId:  id,
      entityRef: `${saved.full_name} — changed: ${changes.join(', ') || 'no changes'}`,
      oldValue,
      newValue,
    });

    return saved;
  }

  async deactivate(id: string, actor: UserContext) {
    const { id: actorId, tenant_id: tenantId } = actor;
    const user = await this.findOne(id, tenantId);

    user.status     = UserStatus.INACTIVE;
    user.updated_by = actorId;
    const saved = await this.usersRepo.save(user);

    await this.auditService.log({
      tenantId,
      userId:    actorId,
      userName:  actor.full_name,
      userRole:  actor.role,
      action:    AuditAction.DEACTIVATE,
      entity:    'User',
      entityId:  id,
      entityRef: `${user.full_name} (${user.role})`,
      oldValue:  { status: UserStatus.ACTIVE },
      newValue:  { status: UserStatus.INACTIVE },
    });

    return saved;
  }

  async activate(id: string, actor: UserContext) {
    const { id: actorId, tenant_id: tenantId } = actor;
    const user = await this.findOne(id, tenantId);

    user.status     = UserStatus.ACTIVE;
    user.updated_by = actorId;
    const saved = await this.usersRepo.save(user);

    await this.auditService.log({
      tenantId,
      userId:    actorId,
      userName:  actor.full_name,
      userRole:  actor.role,
      action:    AuditAction.ACTIVATE,
      entity:    'User',
      entityId:  id,
      entityRef: `${user.full_name} (${user.role})`,
      oldValue:  { status: UserStatus.INACTIVE },
      newValue:  { status: UserStatus.ACTIVE },
    });

    return saved;
  }

  async resetPassword(id: string, newPassword: string, actor: UserContext) {
    const { id: actorId, tenant_id: tenantId } = actor;
    const user = await this.findOne(id, tenantId);

    user.password_hash = await bcrypt.hash(newPassword, 10);
    user.updated_by    = actorId;
    await this.usersRepo.save(user);

    await this.auditService.log({
      tenantId,
      userId:    actorId,
      userName:  actor.full_name,
      userRole:  actor.role,
      action:    AuditAction.PASSWORD_RESET,
      entity:    'User',
      entityId:  id,
      entityRef: `${user.full_name} (${user.role})`,
      newValue:  { reset_by: actor.full_name },
    });

    return { message: 'Password reset successfully' };
  }
}
