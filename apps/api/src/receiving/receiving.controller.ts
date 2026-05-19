import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';
import { ReceivingService } from './receiving.service';
import { VerifyBatchDto, BulkVerifyDto } from './dto/verify-batch.dto';

@ApiTags('Receiving & Verification')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('receiving')
export class ReceivingController {
  constructor(private receivingService: ReceivingService) {}

  @Get('pending')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ 
    summary: 'Get all pending verification batches',
    description: 'Returns stock batches that need physical verification before becoming sellable'
  })
  async getPendingVerification(
    @Request() req,
    @Query('po_id') poId?: string,
  ) {
    return this.receivingService.getPendingBatches(req.user.tenant_id, poId);
  }

  @Post('verify')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ 
    summary: 'Verify a stock batch',
    description: 'Mark batch as verified, partial, or rejected. Supports partial verification.'
  })
  async verifyBatch(
    @Body() verifyDto: VerifyBatchDto,
    @Request() req,
  ) {
    return this.receivingService.verifyBatch(
      verifyDto,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Post('bulk-verify')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ 
    summary: 'Verify multiple batches at once',
    description: 'Bulk verification for entire PO or multiple batches'
  })
  async bulkVerify(
    @Body() bulkVerifyDto: BulkVerifyDto,
    @Request() req,
  ) {
    return this.receivingService.bulkVerifyBatches(
      bulkVerifyDto.batches,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('discrepancies')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ 
    summary: 'Get all verification discrepancies',
    description: 'Shows shortages, damages, and other issues found during verification'
  })
  async getDiscrepancies(
    @Request() req,
    @Query('po_id') poId?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    return this.receivingService.getDiscrepancies(
      req.user.tenant_id,
      poId,
      fromDate,
      toDate,
    );
  }

  @Get('summary/:po_id')
  @Roles(UserRole.OWNER, UserRole.PHARMACIST)
  @ApiOperation({ 
    summary: 'Get verification summary for a PO',
    description: 'Shows total ordered, received, verified, rejected quantities'
  })
  async getVerificationSummary(
    @Param('po_id') poId: string,
    @Request() req,
  ) {
    return this.receivingService.getVerificationSummary(
      poId,
      req.user.tenant_id,
    );
  }
}
