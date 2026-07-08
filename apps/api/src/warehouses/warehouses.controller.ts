import {
  Body,
  Controller,
  Delete,
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
import { CreateWarehouseDto } from './dto/create-warehouse.dto';
import { ReorderWarehousesDto } from './dto/reorder-warehouses.dto';
import { UpdateRootLabelDto } from './dto/update-root-label.dto';
import { UpdateWarehouseDto } from './dto/update-warehouse.dto';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  findAll(
    @CurrentUser() actor: User,
    @Query('parentId') parentId?: string,
    @Query('ownerId') ownerId?: string,
  ) {
    return this.warehousesService.findAll(actor, parentId, ownerId);
  }

  @Patch('reorder')
  @Roles(Role.PLATFORM_ADMIN, Role.ADMIN)
  reorder(@Body() dto: ReorderWarehousesDto, @CurrentUser() actor: User) {
    return this.warehousesService.reorder(dto, actor);
  }

  @Patch('root-label')
  @Roles(Role.ADMIN)
  updateRootLabel(@Body() dto: UpdateRootLabelDto, @CurrentUser() actor: User) {
    return this.warehousesService.updateRootLabel(actor, dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.warehousesService.findOne(id, actor);
  }

  @Post()
  @Roles(Role.PLATFORM_ADMIN, Role.ADMIN)
  create(@Body() dto: CreateWarehouseDto, @CurrentUser() actor: User) {
    return this.warehousesService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateWarehouseDto,
    @CurrentUser() actor: User,
  ) {
    return this.warehousesService.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Role.PLATFORM_ADMIN, Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.warehousesService.remove(id, actor);
  }
}
