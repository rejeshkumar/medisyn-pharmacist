import { Body, Controller, Get, Param, Patch, Post, Query, Req, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../database/entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.RECEPTIONIST, UserRole.OFFICE_MANAGER, UserRole.NURSE, UserRole.DOCTOR, UserRole.PHARMACIST)
  @ApiOperation({ summary: 'List users; supports ?role=doctor filter' })
  findAll(@Request() req, @Query('role') role?: string) {
    return this.usersService.findAll(req.tenantId, role);
  }

  @Post()
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Create new user (Owner only)' })
  create(@Body() dto: CreateUserDto, @Request() req) {
    return this.usersService.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Update user' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, dto, req.user);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Deactivate user' })
  deactivate(@Param('id') id: string, @Request() req) {
    return this.usersService.deactivate(id, req.user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Activate user' })
  activate(@Param('id') id: string, @Request() req) {
    return this.usersService.activate(id, req.user);
  }

  @Patch(':id/reset-password')
  @Roles(UserRole.OWNER)
  @ApiOperation({ summary: 'Reset user password (Owner only)' })
  resetPassword(
    @Param('id') id: string,
    @Body() body: { password: string },
    @Request() req,
  ) {
    return this.usersService.resetPassword(id, body.password, req.user);
  }

  @Patch(':id/consultation-fee')
  updateFee(@Param('id') id: string, @Body() body: { consultation_fee: number }, @Req() req: any) {
    return this.usersService.update(id, { consultation_fee: body.consultation_fee } as any, {
      id: req.user.sub, full_name: req.user.name, role: req.user.role, tenant_id: req.user.tenant_id,
    });
  }
}
