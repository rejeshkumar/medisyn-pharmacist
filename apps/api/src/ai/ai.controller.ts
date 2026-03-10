import { Controller, Post, Body, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClaudeService } from './claude.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { IsString, IsOptional, IsArray, IsNumber, IsObject } from 'class-validator';

export class OcrDto {
  @IsString() base64Image: string;
  @IsString() mediaType: string; // 'image/jpeg' | 'image/png'
}

export class DrugInteractionDto {
  @IsArray() medicines: string[];
}

export class VoiceTranscribeDto {
  @IsString() transcribedText: string;
  @IsOptional() @IsObject() patientContext?: any;
}

export class DiagnosisDto {
  @IsString() symptoms: string;
  @IsOptional() @IsNumber() age?: number;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsObject() vitals?: any;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() existing_conditions?: string;
  @IsOptional() @IsString() current_medicines?: string;
}

@Controller('ai')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiController {
  constructor(private readonly claudeService: ClaudeService) {}

  // POST /ai/ocr — extract prescription from image
  @Post('ocr')
  async ocrPrescription(@Body() dto: OcrDto) {
    return this.claudeService.extractPrescription(dto.base64Image, dto.mediaType);
  }

  // POST /ai/drug-interactions — check medicine combinations
  @Post('drug-interactions')
  async checkInteractions(@Body() dto: DrugInteractionDto) {
    return this.claudeService.checkDrugInteractions(dto.medicines);
  }

  // POST /ai/transcribe — structure voice transcription into notes
  @Post('transcribe')
  async transcribe(@Body() dto: VoiceTranscribeDto) {
    return this.claudeService.transcribeConsultationNotes(dto.transcribedText, dto.patientContext);
  }

  // POST /ai/diagnose — AI diagnosis suggestions
  @Post('diagnose')
  async diagnose(@Body() dto: DiagnosisDto) {
    return this.claudeService.suggestDiagnosis(dto);
  }
}
