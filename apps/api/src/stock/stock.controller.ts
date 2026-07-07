import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { Role } from '@repo/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateMovementDto } from './dto/create-movement.dto';
import { StockService } from './stock.service';

@Controller('stock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('summary')
  getSummary(
    @CurrentUser() actor: User,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.stockService.getSummary(actor, warehouseId);
  }

  @Get('alerts')
  getAlerts(
    @CurrentUser() actor: User,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.stockService.getAlerts(actor, warehouseId);
  }

  @Get('movements')
  listMovements(
    @CurrentUser() actor: User,
    @Query('warehouseId') warehouseId?: string,
    @Query('productId') productId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.stockService.listMovements({
      actor,
      warehouseId,
      productId,
      page: Number(page) || 1,
      limit: Number(limit) || 25,
    });
  }

  @Get(':productId/trend')
  getTrend(
    @Param('productId') productId: string,
    @CurrentUser() actor: User,
    @Query('days') days = '30',
  ) {
    return this.stockService.getTrend(productId, Number(days) || 30, actor);
  }

  @Post('movements')
  @Roles(Role.ADMIN)
  createMovement(@Body() dto: CreateMovementDto, @CurrentUser() actor: User) {
    return this.stockService.createMovement(dto, actor);
  }

  @Patch(':productId/apply-suggestion')
  @Roles(Role.ADMIN)
  applySuggestion(
    @Param('productId') productId: string,
    @CurrentUser() actor: User,
  ) {
    return this.stockService.applySuggestion(productId, actor);
  }
}
