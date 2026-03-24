import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { EmployeesModule } from './employees/employees.module';
import { TimeModule } from './time/time.module';
import { MenuModule } from './menu/menu.module';
import { CompanyModule } from './company/company.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [PrismaModule, AuthModule, EmployeesModule, TimeModule, MenuModule, CompanyModule, OrdersModule],
})
export class AppModule {}
