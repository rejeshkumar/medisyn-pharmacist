import {
  IsUUID, IsString, IsOptional, IsBoolean,
  IsDateString, IsArray, ValidateNested, IsInt, IsEnum,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Converts empty string to undefined so @IsOptional() properly skips validation
const EmptyToUndefined = () => Transform(({ value }) => (value === '' ? undefined : value));

export class CreateConsultationDto {
  @IsUUID()
  queue_id: string;

  @IsUUID()
  patient_id: string;

  @IsString()
  @IsOptional()
  symptoms?: string;

  @IsString()
  @IsOptional()
  examination?: string;

  @IsString()
  diagnosis: string;

  @IsString()
  @IsOptional()
  diagnosis_code?: string;

  @IsString()
  @IsOptional()
  advice?: string;

  @EmptyToUndefined()
  @IsDateString()
  @IsOptional()
  follow_up_date?: string;

  @IsString()
  @IsOptional()
  referral?: string;

  @IsBoolean()
  @IsOptional()
  is_follow_up?: boolean;
}

export class UpdateConsultationDto {
  @IsString()
  @IsOptional()
  symptoms?: string;

  @IsString()
  @IsOptional()
  examination?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  diagnosis_code?: string;

  @IsString()
  @IsOptional()
  advice?: string;

  @EmptyToUndefined()
  @IsDateString()
  @IsOptional()
  follow_up_date?: string;

  @IsString()
  @IsOptional()
  referral?: string;
}

export class PrescriptionItemDto {
  @IsUUID()
  @IsOptional()
  medicine_id?: string;

  @IsString()
  medicine_name: string;

  @IsString()
  @IsOptional()
  dosage?: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsInt()
  @IsOptional()
  quantity?: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsUUID()
  consultation_id: string;

  @IsUUID()
  patient_id: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];
}
