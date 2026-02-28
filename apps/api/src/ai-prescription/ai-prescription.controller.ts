import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { AiPrescriptionService } from './ai-prescription.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('AI Prescription')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/prescription')
export class AiPrescriptionController {
  constructor(private aiService: AiPrescriptionService) {}

  @Post('parse')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload prescription image and extract medicines' })
  async parse(@UploadedFile() file: Express.Multer.File, @Request() req) {
    return this.aiService.uploadAndParse(file, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get recent AI prescriptions' })
  findAll(@Request() req) {
    return this.aiService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get extraction result by ID' })
  findOne(@Param('id') id: string) {
    return this.aiService.findOne(id);
  }

  @Post(':id/finalize')
  @ApiOperation({ summary: 'Approve extracted medicines and move to dispense cart' })
  finalize(@Param('id') id: string, @Body() body: { medicines: any[] }) {
    return this.aiService.finalize(id, body.medicines);
  }
}
