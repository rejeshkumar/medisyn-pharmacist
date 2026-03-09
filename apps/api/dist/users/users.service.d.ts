import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AuditService } from '../audit/audit.service';
import { UserContext } from '../sales/sales.service';
export declare class UsersService {
    private usersRepo;
    private auditService;
    constructor(usersRepo: Repository<User>, auditService: AuditService);
    findAll(tenantId: string): Promise<User[]>;
    findOne(id: string, tenantId: string): Promise<User>;
    create(dto: CreateUserDto, actor: UserContext): Promise<User>;
    update(id: string, dto: UpdateUserDto, actor: UserContext): Promise<User>;
    deactivate(id: string, actor: UserContext): Promise<User>;
    activate(id: string, actor: UserContext): Promise<User>;
    resetPassword(id: string, newPassword: string, actor: UserContext): Promise<{
        message: string;
    }>;
}
