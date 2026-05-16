// apps/api/src/inventory/controllers/inventory-intelligence.controller.ts

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { InventoryIntelligenceService } from '../services/inventory-intelligence.service';
import {
  UpdateInventoryConfigDto,
  AIPredictionRequestDto,
} from '../dto/inventory-intelligence.dto';

@Controller('inventory-intelligence')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryIntelligenceController {
  constructor(
    private readonly intelligenceService: InventoryIntelligenceService,
  ) {}

  // ============================================================================
  // CONFIGURATION ENDPOINTS
  // ============================================================================

  @Get('config')
  @Roles('owner', 'office_manager')
  async getConfig(@Request() req) {
    return this.intelligenceService.getInventoryConfig(req.user.tenantId);
  }

  @Put('config')
  @Roles('owner', 'office_manager')
  async updateConfig(@Request() req, @Body() dto: UpdateInventoryConfigDto) {
    return this.intelligenceService.updateInventoryConfig(
      req.user.tenantId,
      req.user.userId,
      dto,
    );
  }

  // ============================================================================
  // VELOCITY REFRESH ENDPOINTS
  // ============================================================================

  @Post('refresh-velocity/:medicineId')
  @Roles('owner', 'office_manager', 'pharmacist')
  async refreshMedicineVelocity(@Request() req, @Param('medicineId') medicineId: string) {
    await this.intelligenceService.refreshMedicineVelocity(req.user.tenantId, medicineId);
    return { success: true, message: 'Velocity refreshed' };
  }

  @Post('refresh-all-velocities')
  @Roles('owner', 'office_manager')
  async refreshAllVelocities(@Request() req) {
    const count = await this.intelligenceService.refreshAllVelocities(req.user.tenantId);
    return { 
      success: true, 
      message: `Refreshed velocity for ${count} medicines`,
      count 
    };
  }

  // ============================================================================
  // MOVEMENT CATEGORY ENDPOINTS
  // ============================================================================

  @Get('fast-moving')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getFastMoving(@Request() req) {
    return this.intelligenceService.getFastMovingMedicines(req.user.tenantId);
  }

  @Get('slow-moving')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getSlowMoving(@Request() req) {
    return this.intelligenceService.getSlowMovingMedicines(req.user.tenantId);
  }

  @Get('dead-stock')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getDeadStock(@Request() req) {
    return this.intelligenceService.getDeadStockMedicines(req.user.tenantId);
  }

  @Get('stockout-risk')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getStockoutRisk(@Request() req) {
    return this.intelligenceService.getStockoutRiskMedicines(req.user.tenantId);
  }

  @Get('summary')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getMovementSummary(@Request() req) {
    return this.intelligenceService.getMovementSummary(req.user.tenantId);
  }

  // ============================================================================
  // AI PREDICTION ENDPOINTS
  // ============================================================================

  @Post('ai-predict')
  @Roles('owner', 'office_manager')
  async generatePrediction(@Request() req, @Body() dto: AIPredictionRequestDto) {
    return this.intelligenceService.generateAIPrediction(req.user.tenantId, dto);
  }

  @Get('ai-predictions/recent')
  @Roles('owner', 'office_manager')
  async getRecentPredictions(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.intelligenceService.getRecentPredictions(req.user.tenantId, parsedLimit);
  }

  @Get('ai-predictions/medicine/:medicineId')
  @Roles('owner', 'office_manager', 'pharmacist')
  async getMedicinePredictionHistory(@Request() req, @Param('medicineId') medicineId: string) {
    return this.intelligenceService.getMedicinePredictionHistory(req.user.tenantId, medicineId);
  }
}
