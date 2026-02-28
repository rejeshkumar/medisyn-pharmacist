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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcryptjs");
const user_entity_1 = require("../database/entities/user.entity");
let AuthService = class AuthService {
    constructor(usersRepo, jwtService) {
        this.usersRepo = usersRepo;
        this.jwtService = jwtService;
    }
    async login(mobile, password) {
        const user = await this.usersRepo.findOne({ where: { mobile } });
        if (!user)
            throw new common_1.UnauthorizedException('Invalid credentials');
        if (user.status === user_entity_1.UserStatus.INACTIVE)
            throw new common_1.UnauthorizedException('Account is deactivated. Contact admin.');
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid)
            throw new common_1.UnauthorizedException('Invalid credentials');
        const payload = { sub: user.id, role: user.role, name: user.full_name };
        const token = this.jwtService.sign(payload);
        return {
            access_token: token,
            user: {
                id: user.id,
                full_name: user.full_name,
                mobile: user.mobile,
                role: user.role,
            },
        };
    }
    async validateUser(userId) {
        const user = await this.usersRepo.findOne({ where: { id: userId } });
        if (!user || user.status === user_entity_1.UserStatus.INACTIVE)
            return null;
        return user;
    }
    async seedOwner() {
        const existing = await this.usersRepo.findOne({
            where: { mobile: '9999999999' },
        });
        if (!existing) {
            const hash = await bcrypt.hash('admin123', 10);
            const owner = this.usersRepo.create({
                full_name: 'Admin Owner',
                mobile: '9999999999',
                password_hash: hash,
                role: 'owner',
            });
            await this.usersRepo.save(owner);
            console.log('✅ Default owner seeded: mobile=9999999999, password=admin123');
        }
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map