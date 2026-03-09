import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private usersRepo;
    constructor(configService: ConfigService, usersRepo: Repository<User>);
    validate(payload: any): Promise<{
        id: string;
        full_name: string;
        role: import("../database/entities/user.entity").UserRole;
        tenant_id: string;
        tenant_mode: string;
    }>;
}
export {};
