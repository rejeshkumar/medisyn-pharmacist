import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SubstitutesService } from './substitutes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Substitutes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('substitutes')
export class SubstitutesController {
  constructor(private substitutesService: SubstitutesService) {}

  @Get()
  @ApiOperation({ summary: 'Get substitute medicines for a given medicine ID' })
  @ApiQuery({ name: 'medicine_id', required: true })
  getSubstitutes(@Query('medicine_id') medicineId: string) {
    return this.substitutesService.getSubstitutes(medicineId);
  }
}
