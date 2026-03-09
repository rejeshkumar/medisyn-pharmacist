import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(req: any): Promise<import("../database/entities/user.entity").User[]>;
    create(dto: CreateUserDto, req: any): Promise<import("../database/entities/user.entity").User>;
    update(id: string, dto: UpdateUserDto, req: any): Promise<import("../database/entities/user.entity").User>;
    deactivate(id: string, req: any): Promise<import("../database/entities/user.entity").User>;
    activate(id: string, req: any): Promise<import("../database/entities/user.entity").User>;
    resetPassword(id: string, body: {
        password: string;
    }, req: any): Promise<{
        message: string;
    }>;
}
