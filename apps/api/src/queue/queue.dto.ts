import { IsUUID, IsEnum, IsOptional, IsString, IsInt, IsDateString } from 'class-validator';
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
}

export class UpdateQueueStatusDto {
  @IsEnum(['waiting','in_precheck','precheck_done','in_consultation',
           'consultation_done','dispensing','completed','cancelled','no_show'])
  status: string;

  @IsUUID()
  @IsOptional()
  doctor_id?: string;
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
