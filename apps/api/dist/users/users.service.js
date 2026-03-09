"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcryptjs");
const user_entity_1 = require("../database/entities/user.entity");
const audit_service_1 = require("../audit/audit.service");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
let UsersService = class UsersService {
    constructor(usersRepo, auditService) {
        this.usersRepo = usersRepo;
        this.auditService = auditService;
    }
    async findAll(tenantId) {
        return this.usersRepo.find({
            where: { tenant_id: tenantId },
            order: { created_at: 'DESC' },
        });
    }
    async findOne(id, tenantId) {
        const user = await this.usersRepo.findOne({ where: { id, tenant_id: tenantId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async create(dto, actor) {
        const { id: actorId, tenant_id: tenantId } = actor;
        const existing = await this.usersRepo.findOne({
            where: { mobile: dto.mobile, tenant_id: tenantId },
        });
        if (existing)
            throw new common_1.ConflictException('Mobile number already registered');
        const hash = await bcrypt.hash(dto.password, 10);
        const user = this.usersRepo.create({
            full_name: dto.full_name,
            mobile: dto.mobile,
            password_hash: hash,
            role: dto.role,
            tenant_id: tenantId,
            created_by: actorId,
        });
        const saved = await this.usersRepo.save(user);
        await this.auditService.log({
            tenantId,
            userId: actorId,
            userName: actor.full_name,
            userRole: actor.role,
            action: audit_log_entity_1.AuditAction.CREATE,
            entity: 'User',
            entityId: saved.id,
            entityRef: `${saved.full_name} (${saved.role})`,
            newValue: { full_name: saved.full_name, role: saved.role, mobile: saved.mobile },
        });
        return saved;
    }
    async update(id, dto, actor) {
        const { id: actorId, tenant_id: tenantId } = actor;
        const user = await this.findOne(id, tenantId);
        if (dto.password) {
            dto.password_hash = await bcrypt.hash(dto.password, 10);
            delete dto.password;
        }
        Object.assign(user, dto);
        user.updated_by = actorId;
        return this.usersRepo.save(user);
    }
    async deactivate(id, actor) {
        const { id: actorId, tenant_id: tenantId } = actor;
        const user = await this.findOne(id, tenantId);
        user.status = user_entity_1.UserStatus.INACTIVE;
        user.updated_by = actorId;
        const saved = await this.usersRepo.save(user);
        await this.auditService.log({
            tenantId,
            userId: actorId,
            userName: actor.full_name,
            userRole: actor.role,
            action: audit_log_entity_1.AuditAction.DEACTIVATE,
            entity: 'User',
            entityId: id,
            entityRef: `${user.full_name} (${user.role})`,
            oldValue: { status: user_entity_1.UserStatus.ACTIVE },
            newValue: { status: user_entity_1.UserStatus.INACTIVE },
        });
        return saved;
    }
    async activate(id, actor) {
        const { id: actorId, tenant_id: tenantId } = actor;
        const user = await this.findOne(id, tenantId);
        user.status = user_entity_1.UserStatus.ACTIVE;
        user.updated_by = actorId;
        const saved = await this.usersRepo.save(user);
        await this.auditService.log({
            tenantId,
            userId: actorId,
            userName: actor.full_name,
            userRole: actor.role,
            action: audit_log_entity_1.AuditAction.ACTIVATE,
            entity: 'User',
            entityId: id,
            entityRef: `${user.full_name} (${user.role})`,
            oldValue: { status: user_entity_1.UserStatus.INACTIVE },
            newValue: { status: user_entity_1.UserStatus.ACTIVE },
        });
        return saved;
    }
    async resetPassword(id, newPassword, actor) {
        const { id: actorId, tenant_id: tenantId } = actor;
        const user = await this.findOne(id, tenantId);
        user.password_hash = await bcrypt.hash(newPassword, 10);
        user.updated_by = actorId;
        await this.usersRepo.save(user);
        await this.auditService.log({
            tenantId,
            userId: actorId,
            userName: actor.full_name,
            userRole: actor.role,
            action: audit_log_entity_1.AuditAction.PASSWORD_RESET,
            entity: 'User',
            entityId: id,
            entityRef: `${user.full_name} (${user.role})`,
            newValue: { reset_by: actor.full_name },
        });
        return { message: 'Password reset successfully' };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        audit_service_1.AuditService])
], UsersService);
//# sourceMappingURL=users.service.js.map