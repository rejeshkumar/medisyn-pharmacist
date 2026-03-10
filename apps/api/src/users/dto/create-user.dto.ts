import { IsString, IsNotEmpty, IsEnum, MinLength, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../database/entities/user.entity';

export class CreateUserDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  full_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty()
  @IsEnum(UserRole)
  role: UserRole;

  @ApiProperty({ required: false })
  @IsArray()
  @IsOptional()
  @IsEnum(UserRole, { each: true })
  roles?: UserRole[];
}
