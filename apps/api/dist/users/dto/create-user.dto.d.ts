import { UserRole } from '../../database/entities/user.entity';
export declare class CreateUserDto {
    full_name: string;
    mobile: string;
    password: string;
    role: UserRole;
}
