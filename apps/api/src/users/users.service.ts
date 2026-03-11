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

  async findAll(tenantId: string) {
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

    // Derive roles: use dto.roles if provided, else wrap single role
    const roles: string[] = dto.roles?.length ? dto.roles : [dto.role];
    // Primary role = first in roles array
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

    if (dto.password) {
      (dto as any).password_hash = await bcrypt.hash(dto.password, 10);
      delete dto.password;
    }

    // Handle roles array update
    if (dto.roles?.length) {
      user.roles = dto.roles;
      // Keep primary role in sync with first entry in roles array
      user.role = dto.roles[0] as any;
    } else if (dto.role) {
      // Single role update — wrap into array too
      user.role = dto.role;
      user.roles = [dto.role];
    }

    // Apply other fields (full_name, mobile, password_hash)
    if (dto.full_name) user.full_name = dto.full_name;
    if (dto.mobile)    user.mobile    = dto.mobile;
    if ((dto as any).password_hash) user.password_hash = (dto as any).password_hash;

    user.updated_by = actorId;
    return this.usersRepo.save(user);
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
