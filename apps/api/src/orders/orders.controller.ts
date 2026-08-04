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
import { OrderStatus, Role } from '@repo/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { DecideOrderDto } from './dto/decide-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  list(
    @CurrentUser() actor: User,
    @Query('status') status?: OrderStatus,
    @Query('warehouseId') warehouseId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '25',
  ) {
    return this.ordersService.list({
      actor,
      status,
      warehouseId,
      page: Number(page) || 1,
      limit: Number(limit) || 25,
    });
  }

  @Post()
  @Roles(Role.USER, Role.ADMIN)
  create(@Body() dto: CreateOrderDto, @CurrentUser() actor: User) {
    return this.ordersService.create(dto, actor);
  }

  @Patch(':id/fulfill')
  @Roles(Role.ADMIN, Role.PLATFORM_ADMIN)
  fulfill(
    @Param('id') id: string,
    @Body() dto: DecideOrderDto,
    @CurrentUser() actor: User,
  ) {
    return this.ordersService.fulfill(id, dto, actor);
  }

  @Patch(':id/reject')
  @Roles(Role.ADMIN, Role.PLATFORM_ADMIN)
  reject(
    @Param('id') id: string,
    @Body() dto: DecideOrderDto,
    @CurrentUser() actor: User,
  ) {
    return this.ordersService.reject(id, dto, actor);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.ordersService.cancel(id, actor);
  }
}
