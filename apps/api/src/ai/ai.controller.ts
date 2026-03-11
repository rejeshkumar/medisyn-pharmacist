import { Controller, Post, Get, Body, Req, UseGuards, UploadedFile, UseInterceptors, HttpException, HttpStatus } from '@nestjs/common';
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
export class AiController {
  constructor(private readonly claudeService: ClaudeService) {}

  // GET /ai/health — public, no auth — check if Claude API key is configured and valid
  @Get('health')
  async health() {
    const result = await this.claudeService.healthCheck();
    if (!result.ok) {
      throw new HttpException({ ok: false, reason: result.reason }, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return { ok: true, message: 'Claude API is connected and working' };
  }

  // POST /ai/ocr — extract prescription from image
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('ocr')
  async ocrPrescription(@Body() dto: OcrDto) {
    return this.claudeService.extractPrescription(dto.base64Image, dto.mediaType);
  }

  // POST /ai/drug-interactions — check medicine combinations
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('drug-interactions')
  async checkInteractions(@Body() dto: DrugInteractionDto) {
    return this.claudeService.checkDrugInteractions(dto.medicines);
  }

  // POST /ai/transcribe — structure voice transcription into notes
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('transcribe')
  async transcribe(@Body() dto: VoiceTranscribeDto) {
    try {
      return await this.claudeService.transcribeConsultationNotes(dto.transcribedText, dto.patientContext);
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isKeyMissing = msg.includes('missing') || msg.includes('401') || msg.includes('authentication');
      throw new HttpException(
        { message: isKeyMissing ? 'AI not configured: ANTHROPIC_API_KEY missing or invalid on server' : `AI error: ${msg}` },
        isKeyMissing ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // POST /ai/diagnose — AI diagnosis suggestions
  @UseGuards(JwtAuthGuard, TenantGuard)
  @Post('diagnose')
  async diagnose(@Body() dto: DiagnosisDto) {
    return this.claudeService.suggestDiagnosis(dto);
  }
}
