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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../database/entities/user.entity';
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

  @Get('config')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER)
  async getConfig(@Request() req) {
    return this.intelligenceService.getInventoryConfig(req.user.tenant_id);
  }

  @Put('config')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER)
  async updateConfig(@Request() req, @Body() dto: UpdateInventoryConfigDto) {
    return this.intelligenceService.updateInventoryConfig(
      req.user.tenant_id,
      req.user.sub,
      dto,
    );
  }

  @Post('refresh-velocity/:medicineId')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async refreshMedicineVelocity(@Request() req, @Param('medicineId') medicineId: string) {
    await this.intelligenceService.refreshMedicineVelocity(req.user.tenant_id, medicineId);
    return { success: true, message: 'Velocity refreshed' };
  }

  @Post('refresh-all-velocities')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER)
  async refreshAllVelocities(@Request() req) {
    const count = await this.intelligenceService.refreshAllVelocities(req.user.tenant_id);
    return { 
      success: true, 
      message: `Refreshed velocity for ${count} medicines`,
      count 
    };
  }

  @Get('fast-moving')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getFastMoving(@Request() req) {
    return this.intelligenceService.getFastMovingMedicines(req.user.tenant_id);
  }

  @Get('slow-moving')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getSlowMoving(@Request() req) {
    return this.intelligenceService.getSlowMovingMedicines(req.user.tenant_id);
  }

  @Get('dead-stock')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getDeadStock(@Request() req) {
    return this.intelligenceService.getDeadStockMedicines(req.user.tenant_id);
  }

  @Get('stockout-risk')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getStockoutRisk(@Request() req) {
    return this.intelligenceService.getStockoutRiskMedicines(req.user.tenant_id);
  }

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getMovementSummary(@Request() req) {
    return this.intelligenceService.getMovementSummary(req.user.tenant_id);
  }

  @Post('ai-predict')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER)
  async generatePrediction(@Request() req, @Body() dto: AIPredictionRequestDto) {
    return this.intelligenceService.generateAIPrediction(req.user.tenant_id, dto);
  }

  @Get('ai-predictions/recent')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER)
  async getRecentPredictions(@Request() req, @Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.intelligenceService.getRecentPredictions(req.user.tenant_id, parsedLimit);
  }

  @Get('ai-predictions/medicine/:medicineId')
  @Roles(UserRole.OWNER, UserRole.OFFICE_MANAGER, UserRole.PHARMACIST)
  async getMedicinePredictionHistory(@Request() req, @Param('medicineId') medicineId: string) {
    return this.intelligenceService.getMedicinePredictionHistory(req.user.tenant_id, medicineId);
  }
}
