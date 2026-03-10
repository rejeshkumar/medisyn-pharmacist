import { IsInt, IsString, IsBoolean, IsOptional, IsUUID, Min, Max, IsDateString } from 'class-validator';

export class UpsertAvailabilityDto {
  @IsInt() @Min(0) @Max(6)
  day_of_week: number;

  @IsString()
  start_time: string; // 'HH:MM'

  @IsString()
  end_time: string;

  @IsInt() @IsOptional()
  slot_duration_mins?: number;

  @IsInt() @IsOptional()
  max_patients_per_slot?: number;

  @IsBoolean() @IsOptional()
  is_active?: boolean;
}

export class AddLeaveDto {
  @IsDateString()
  leave_date: string;

  @IsString() @IsOptional()
  reason?: string;
}

export class GetSlotsDto {
  @IsDateString()
  date: string;
}
