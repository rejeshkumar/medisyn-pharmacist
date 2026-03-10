import { IsString, IsOptional, IsEnum, MinLength, IsArray } from 'class-validator';
import { UserRole } from '../../database/entities/user.entity';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  full_name?: string;

  @IsString()
  @IsOptional()
  mobile?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @IsArray()
  @IsOptional()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}
