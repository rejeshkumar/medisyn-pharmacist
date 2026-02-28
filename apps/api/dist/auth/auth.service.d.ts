import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
export declare class AuthService {
    private usersRepo;
    private jwtService;
    constructor(usersRepo: Repository<User>, jwtService: JwtService);
    login(mobile: string, password: string): Promise<{
        access_token: string;
        user: {
            id: string;
            full_name: string;
            mobile: string;
            role: import("../database/entities/user.entity").UserRole;
        };
    }>;
    validateUser(userId: string): Promise<User>;
    seedOwner(): Promise<void>;
}
