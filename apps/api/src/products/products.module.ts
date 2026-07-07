import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StockModule } from '../stock/stock.module';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuditLogModule, StockModule],
  controllers: [ProductsController, CategoriesController],
  providers: [ProductsService, CategoriesService],
})
export class ProductsModule {}
