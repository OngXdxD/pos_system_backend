import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { TimeModule } from './time/time.module';
import { MenuModule } from './menu/menu.module';
import { ProductsModule } from './products/products.module';
import { OrdersModule } from './orders/orders.module';
import { SalesModule } from './sales/sales.module';

@Module({
  imports: [PrismaModule, AuthModule, EmployeesModule, TimeModule, MenuModule, ProductsModule, OrdersModule, SalesModule],
})
export class AppModule {}
