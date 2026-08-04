import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { StockModule } from '../stock/stock.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuditLogModule, StockModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
