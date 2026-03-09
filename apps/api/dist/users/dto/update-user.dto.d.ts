import { UserRole } from '../../database/entities/user.entity';
export declare class UpdateUserDto {
    full_name?: string;
    mobile?: string;
    password?: string;
    role?: UserRole;
}
