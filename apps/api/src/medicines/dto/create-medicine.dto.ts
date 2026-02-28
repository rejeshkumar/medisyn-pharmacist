import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ScheduleClass, DosageForm, RxUnit, IntakeRoute } from '../../database/entities/medicine.entity';

export class CreateMedicineDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  brand_name: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  molecule: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  strength: string;

  @ApiProperty({ enum: DosageForm, default: DosageForm.TABLET })
  @IsString()
  @IsNotEmpty()
  dosage_form: string;

  @ApiProperty({ enum: ScheduleClass })
  @IsEnum(ScheduleClass)
  schedule_class: ScheduleClass;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  substitute_group_key?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  gst_percent?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  mrp?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  sale_rate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  category?: string;

  // ── New fields ──────────────────────────────────────────────────────────────

  @ApiPropertyOptional({ enum: RxUnit, description: 'Dispensing unit (mg, ml, units, etc.)' })
  @IsString()
  @IsOptional()
  rx_units?: string;

  @ApiPropertyOptional({ description: 'Stock group / therapeutic group' })
  @IsString()
  @IsOptional()
  stock_group?: string;

  @ApiPropertyOptional({ description: 'What condition this medicine treats' })
  @IsString()
  @IsOptional()
  treatment_for?: string;

  @ApiPropertyOptional({ description: 'Additional notes or description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Default medicine-level discount percentage' })
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_percent?: number;

  @ApiPropertyOptional({ description: 'Shelf / rack location in pharmacy (e.g. A-12)' })
  @IsString()
  @IsOptional()
  rack_location?: string;

  @ApiPropertyOptional({ enum: IntakeRoute, description: 'Route of administration' })
  @IsString()
  @IsOptional()
  intake_route?: string;

  @ApiPropertyOptional({ description: 'Minimum stock qty before reorder alert' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  reorder_qty?: number;

  @ApiPropertyOptional({ description: 'Whether a prescription (Rx) is mandatory' })
  @IsBoolean()
  @IsOptional()
  is_rx_required?: boolean;
}
