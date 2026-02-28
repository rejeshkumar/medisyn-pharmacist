import {
  IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean,
  IsEmail, IsInt, Min, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Salutation, Gender, PatientCategory } from '../../database/entities/patient.entity';

export class CreatePatientDto {
  @ApiPropertyOptional({ enum: Salutation })
  @IsEnum(Salutation)
  @IsOptional()
  salutation?: Salutation;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  age?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ enum: PatientCategory })
  @IsEnum(PatientCategory)
  @IsOptional()
  category?: PatientCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ref_by?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  residence_number?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_first_visit?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_vip?: boolean;

  @ApiPropertyOptional({ description: 'VIP pass start date (defaults to today)' })
  @IsDateString()
  @IsOptional()
  vip_start_date?: string;

  @ApiPropertyOptional({ description: 'VIP pass end date (defaults to start + 1 year)' })
  @IsDateString()
  @IsOptional()
  vip_end_date?: string;
}

export class VipRegisterDto {
  @ApiPropertyOptional({ enum: Salutation })
  @IsEnum(Salutation)
  @IsOptional()
  salutation?: Salutation;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  last_name?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiPropertyOptional({ enum: Gender })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  area?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  vip_registered_by?: string;
}
