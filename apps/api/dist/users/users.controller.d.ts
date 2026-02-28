import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
export declare class UsersController {
    private usersService;
    constructor(usersService: UsersService);
    findAll(): Promise<import("../database/entities/user.entity").User[]>;
    create(dto: CreateUserDto): Promise<import("../database/entities/user.entity").User>;
    update(id: string, dto: UpdateUserDto): Promise<import("../database/entities/user.entity").User>;
    deactivate(id: string): Promise<import("../database/entities/user.entity").User>;
    activate(id: string): Promise<import("../database/entities/user.entity").User>;
}
