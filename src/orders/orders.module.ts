import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrintingModule } from '../printing/printing.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule, PrintingModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
