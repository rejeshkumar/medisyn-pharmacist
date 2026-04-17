import { IsUUID, IsEnum, IsOptional, IsString, IsInt, IsBoolean, IsNumber } from 'class-validator';
import { ConsultationType } from './queue.entity';

export class CreateQueueDto {
  @IsUUID()
  patient_id: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;

  @IsEnum(ConsultationType)
  @IsOptional()
  visit_type?: ConsultationType;

  @IsString()
  @IsOptional()
  chief_complaint?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  is_emergency?: boolean;

  @IsBoolean()
  @IsOptional()
  skip_precheck?: boolean;

  @IsString()
  @IsOptional()
  skip_reason?: string;

  @IsNumber()
  @IsOptional()
  consultation_fee?: number;

  @IsString()
  @IsOptional()
  scheduled_time?: string;

  @IsString()
  @IsOptional()
  slot_date?: string;
}

export class UpdateQueueStatusDto {
  @IsEnum(['waiting','in_precheck','precheck_done','in_consultation',
           'consultation_done','dispensing','completed','cancelled','no_show','emergency','payment_pending'])
  status: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;

  @IsString()
  @IsOptional()
  override_reason?: string;
}

export class RecordPreCheckDto {
  @IsUUID()
  queue_id: string;

  @IsInt()
  @IsOptional()
  bp_systolic?: number;

  @IsInt()
  @IsOptional()
  bp_diastolic?: number;

  @IsInt()
  @IsOptional()
  pulse_rate?: number;

  @IsOptional()
  temperature?: number;

  @IsOptional()
  weight?: number;

  @IsOptional()
  height?: number;

  @IsInt()
  @IsOptional()
  spo2?: number;

  @IsOptional()
  blood_sugar?: number;

  @IsString()
  @IsOptional()
  chief_complaint?: string;

  @IsString()
  @IsOptional()
  allergies?: string;

  @IsString()
  @IsOptional()
  current_medicines?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
