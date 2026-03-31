import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { ChangeOrderPaymentDto } from './dto/change-order-payment.dto';
import { PrintOrderDto } from './dto/print-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @HttpCode(201)
  create(@Body() dto: CreateOrderDto) {
    return this.orders.create(dto);
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('employeeId') employeeId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.orders.findAll(status, employeeId, from, to, limit, offset);
  }

  /** Audit trail for an order (admin / support). */
  @Get(':id/audit')
  getAudit(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.getAudit(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(id);
  }

  @Post(':id/print')
  @HttpCode(200)
  printThermal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PrintOrderDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.orders.printThermal(id, dto.variant, authorization);
  }

  @Post(':id/refund')
  refund(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RefundOrderDto) {
    return this.orders.refund(id, dto.employeePasscode);
  }

  @Post(':id/payment-method')
  changePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrderPaymentDto,
  ) {
    return this.orders.changePaymentMethod(id, dto);
  }
}
