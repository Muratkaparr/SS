import { extname, join } from 'path';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { User } from '@prisma/client';
import { Role } from '@repo/shared-types';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { DuplicateProductDto } from './dto/duplicate-product.dto';
import { ReorderProductsDto } from './dto/reorder-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(
    @CurrentUser() actor: User,
    @Query('warehouseId') warehouseId?: string,
    @Query('search') search?: string,
    @Query('categoryId') categoryId?: string,
    @Query('criticalOnly') criticalOnly?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.productsService.findAll({
      actor,
      warehouseId,
      search,
      categoryId,
      criticalOnly: criticalOnly === 'true',
      page: Number(page) || 1,
      limit: Number(limit) || 20,
    });
  }

  @Patch('reorder')
  @Roles(Role.ADMIN)
  reorder(@Body() dto: ReorderProductsDto, @CurrentUser() actor: User) {
    return this.productsService.reorder(dto.ids, actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.productsService.findOne(id, actor);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateProductDto, @CurrentUser() actor: User) {
    return this.productsService.create(dto, actor);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() actor: User,
  ) {
    return this.productsService.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() actor: User) {
    return this.productsService.remove(id, actor);
  }

  @Post(':id/duplicate')
  @Roles(Role.ADMIN)
  duplicate(
    @Param('id') id: string,
    @Body() dto: DuplicateProductDto,
    @CurrentUser() actor: User,
  ) {
    return this.productsService.duplicate(id, dto, actor);
  }

  @Post(':id/image')
  @Roles(Role.ADMIN, Role.PLATFORM_ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: join(__dirname, '..', '..', 'uploads', 'products'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
          cb(
            new BadRequestException(
              'Sadece JPEG, PNG, WEBP veya GIF yükleyebilirsiniz',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: User,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya bulunamadı');
    }
    return this.productsService.setImage(
      id,
      `/uploads/products/${file.filename}`,
      actor,
    );
  }
}
