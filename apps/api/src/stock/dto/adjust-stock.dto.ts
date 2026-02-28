import { IsString, IsEnum, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AdjustmentType } from '../../database/entities/stock-adjustment.entity';

export class AdjustStockDto {
  @ApiProperty()
  @IsString()
  batch_id: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ApiProperty({ enum: AdjustmentType })
  @IsEnum(AdjustmentType)
  adjustment_type: AdjustmentType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
