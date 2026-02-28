import {
  IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReminderType } from '../../database/entities/patient-reminder.entity';

export class CreateReminderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty()
  @IsDateString()
  remind_at: string;

  @ApiPropertyOptional({ enum: ReminderType })
  @IsEnum(ReminderType)
  @IsOptional()
  type?: ReminderType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  appointment_id?: string;
}
