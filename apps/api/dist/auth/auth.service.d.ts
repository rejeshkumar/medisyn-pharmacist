import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User, UserRole } from '../database/entities/user.entity';
import { Tenant, TenantMode } from '../database/entities/tenant.entity';
export declare class AuthService {
    private usersRepo;
    private tenantsRepo;
    private jwtService;
    constructor(usersRepo: Repository<User>, tenantsRepo: Repository<Tenant>, jwtService: JwtService);
    login(mobile: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            full_name: string;
            mobile: string;
            role: UserRole;
            tenant_id: string;
            tenant_mode: TenantMode;
        };
    }>;
    validateUser(userId: string): Promise<User | null>;
    seedOwner(): Promise<void>;
}
