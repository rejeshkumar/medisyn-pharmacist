import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMode } from '../../database/entities/sale.entity';

export class SaleItemDto {
  @ApiProperty()
  @IsString()
  medicine_id: string;

  @ApiProperty()
  @IsString()
  batch_id: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  qty: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  rate?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  gst_percent?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  is_substituted?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  original_medicine_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  substitution_reason?: string;
}

export class ComplianceDataDto {
  @ApiProperty()
  @IsString()
  patient_name: string;

  @ApiProperty()
  @IsString()
  doctor_name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  doctor_reg_no?: string;
}

export class CreateSaleDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customer_name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  doctor_name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  doctor_reg_no?: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_amount?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_percent?: number;

  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  payment_mode: PaymentMode;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  prescription_image_url?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ai_prescription_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ComplianceDataDto)
  compliance_data?: ComplianceDataDto;
}
