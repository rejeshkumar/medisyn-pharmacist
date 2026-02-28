import {
  IsString, IsNotEmpty, IsEnum, IsOptional, IsBoolean, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType, AppointmentStatus } from '../../database/entities/patient-appointment.entity';

export class CreateAppointmentDto {
  @ApiProperty()
  @IsDateString()
  appointment_date: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appointment_time?: string;

  @ApiPropertyOptional({ enum: AppointmentType })
  @IsEnum(AppointmentType)
  @IsOptional()
  type?: AppointmentType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  doctor_name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateAppointmentDto {
  @ApiPropertyOptional({ enum: AppointmentStatus })
  @IsEnum(AppointmentStatus)
  @IsOptional()
  status?: AppointmentStatus;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cancellation_reason?: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  appointment_date?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appointment_time?: string;
}
