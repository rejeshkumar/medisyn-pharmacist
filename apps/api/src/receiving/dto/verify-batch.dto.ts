import { IsUUID, IsNumber, IsString, IsOptional, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyBatchDto {
  @ApiProperty({ description: 'Stock batch ID to verify' })
  @IsUUID()
  batch_id: string;

  @ApiProperty({ description: 'Quantity that passed verification' })
  @IsNumber()
  @Min(0)
  verified_qty: number;

  @ApiProperty({ description: 'Quantity rejected (damaged/shortage)', required: false })
  @IsNumber()
  @Min(0)
  @IsOptional()
  rejected_qty?: number;

  @ApiProperty({ description: 'Notes about discrepancy', required: false })
  @IsString()
  @IsOptional()
  discrepancy_notes?: string;
}

export class BulkVerifyDto {
  @ApiProperty({ description: 'Array of batches to verify', type: [VerifyBatchDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VerifyBatchDto)
  batches: VerifyBatchDto[];
}
