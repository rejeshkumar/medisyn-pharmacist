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
exports.AuditQueryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_log_entity_1 = require("../database/entities/audit-log.entity");
let AuditQueryService = class AuditQueryService {
    constructor(repo) {
        this.repo = repo;
    }
    async getLogs(tenantId, filters) {
        const { from, to, userId, action, entity, entityId, page, limit } = filters;
        const qb = this.repo
            .createQueryBuilder('log')
            .where('log.tenant_id = :tenantId', { tenantId })
            .orderBy('log.created_at', 'DESC')
            .skip((page - 1) * limit)
            .take(limit);
        if (from) {
            qb.andWhere('log.created_at >= :from', { from: new Date(from) });
        }
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            qb.andWhere('log.created_at <= :to', { to: toDate });
        }
        if (userId)
            qb.andWhere('log.user_id = :userId', { userId });
        if (action)
            qb.andWhere('log.action = :action', { action });
        if (entity)
            qb.andWhere('log.entity = :entity', { entity });
        if (entityId)
            qb.andWhere('log.entity_id = :entityId', { entityId });
        const [data, total] = await qb.getManyAndCount();
        return {
            data,
            meta: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
            },
        };
    }
    async getSummary(tenantId, filters) {
        const { from, to } = filters;
        const qb = this.repo
            .createQueryBuilder('log')
            .select('log.action', 'action')
            .addSelect('COUNT(*)', 'count')
            .where('log.tenant_id = :tenantId', { tenantId })
            .groupBy('log.action')
            .orderBy('count', 'DESC');
        if (from)
            qb.andWhere('log.created_at >= :from', { from: new Date(from) });
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            qb.andWhere('log.created_at <= :to', { to: toDate });
        }
        const rows = await qb.getRawMany();
        const activeUsersQb = this.repo
            .createQueryBuilder('log')
            .select('log.user_id', 'user_id')
            .addSelect('log.user_name', 'user_name')
            .addSelect('COUNT(*)', 'count')
            .where('log.tenant_id = :tenantId', { tenantId })
            .groupBy('log.user_id')
            .addGroupBy('log.user_name')
            .orderBy('count', 'DESC');
        if (from)
            activeUsersQb.andWhere('log.created_at >= :from', { from: new Date(from) });
        if (to) {
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59, 999);
            activeUsersQb.andWhere('log.created_at <= :to', { to: toDate });
        }
        const activeUsers = await activeUsersQb.getRawMany();
        return {
            by_action: rows.map(r => ({ action: r.action, count: Number(r.count) })),
            by_user: activeUsers.map(r => ({
                user_id: r.user_id,
                user_name: r.user_name,
                count: Number(r.count),
            })),
            total_events: rows.reduce((sum, r) => sum + Number(r.count), 0),
        };
    }
};
exports.AuditQueryService = AuditQueryService;
exports.AuditQueryService = AuditQueryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(audit_log_entity_1.AuditLog)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], AuditQueryService);
//# sourceMappingURL=audit-query.service.js.map