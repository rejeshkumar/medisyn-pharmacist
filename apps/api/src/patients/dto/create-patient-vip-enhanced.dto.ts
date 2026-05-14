import { IsString, IsNotEmpty, IsEnum, IsOptional, IsNumber, IsEmail, ValidateIf, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

enum PaymentMethod {
  UPI = 'upi',
  CASH = 'cash',
}

export class VipRegisterEnhancedDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  salutation?: string;

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

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gender?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  dob?: string;

  @ApiPropertyOptional()
  @Transform(({ value }) => value === '' ? undefined : value)
  @ValidateIf((o) => o.email !== '' && o.email !== null && o.email !== undefined)
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

  @ApiProperty({ description: 'Sales agent code from URL' })
  @IsString()
  @IsNotEmpty()
  agent_code: string;

  @ApiProperty({ description: 'Security token for validation' })
  @IsString()
  @IsNotEmpty()
  access_token: string;

  @ApiProperty({ description: 'VIP category: individual, family, or extended' })
  @IsString()
  @IsNotEmpty()
  vip_category: string;

  @ApiProperty({ enum: PaymentMethod, description: 'Payment method: upi or cash' })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  payment_method: PaymentMethod;

  @ApiProperty({ description: 'Payment amount in INR' })
  @IsNumber()
  @IsNotEmpty()
  payment_amount: number;

  @ApiPropertyOptional({ description: 'UPI transaction ID (required if payment_method is upi)' })
  @ValidateIf((o) => o.payment_method === PaymentMethod.UPI)
  @IsString()
  @IsNotEmpty()
  upi_txn_id?: string;
}
