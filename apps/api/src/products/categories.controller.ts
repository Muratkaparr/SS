import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type { User } from '@prisma/client';
import { Role } from '@repo/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CategoriesService } from './categories.service';

class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

class UpdateCategoryDto {
  @IsString()
  @MinLength(2)
  name!: string;
}

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCategoryDto, @CurrentUser() actor: User) {
    return this.categoriesService.create(dto.name, actor);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() actor: User,
  ) {
    return this.categoriesService.update(id, dto.name, actor);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.categoriesService.remove(id, actor);
  }
}
