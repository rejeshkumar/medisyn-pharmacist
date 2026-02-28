import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseItemDto {
  @ApiProperty()
  @IsString()
  medicine_id: string;

  @ApiProperty()
  @IsString()
  batch_number: string;

  @ApiProperty()
  @IsDateString()
  expiry_date: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  purchase_price: number;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  mrp: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sale_rate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class AddPurchaseDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplier_id?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  invoice_no?: string;

  @ApiProperty({ type: [PurchaseItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items: PurchaseItemDto[];
}
