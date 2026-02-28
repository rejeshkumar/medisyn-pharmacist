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
let UsersService = class UsersService {
    constructor(usersRepo) {
        this.usersRepo = usersRepo;
    }
    async findAll() {
        return this.usersRepo.find({ order: { created_at: 'DESC' } });
    }
    async findOne(id) {
        const user = await this.usersRepo.findOne({ where: { id } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async create(dto) {
        const existing = await this.usersRepo.findOne({
            where: { mobile: dto.mobile },
        });
        if (existing)
            throw new common_1.ConflictException('Mobile number already registered');
        const hash = await bcrypt.hash(dto.password, 10);
        const user = this.usersRepo.create({
            full_name: dto.full_name,
            mobile: dto.mobile,
            password_hash: hash,
            role: dto.role,
        });
        return this.usersRepo.save(user);
    }
    async update(id, dto) {
        const user = await this.findOne(id);
        if (dto.password) {
            dto['password_hash'] = await bcrypt.hash(dto.password, 10);
            delete dto.password;
        }
        Object.assign(user, dto);
        return this.usersRepo.save(user);
    }
    async deactivate(id) {
        const user = await this.findOne(id);
        user.status = user_entity_1.UserStatus.INACTIVE;
        return this.usersRepo.save(user);
    }
    async activate(id) {
        const user = await this.findOne(id);
        user.status = user_entity_1.UserStatus.ACTIVE;
        return this.usersRepo.save(user);
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], UsersService);
//# sourceMappingURL=users.service.js.map