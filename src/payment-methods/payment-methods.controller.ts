import { Body, Controller, Get, Put } from '@nestjs/common';
import { PaymentMethodsService } from './payment-methods.service';
import { PutPaymentMethodsDto } from './dto/put-payment-methods.dto';

@Controller('payment-methods')
export class PaymentMethodsController {
  constructor(private readonly paymentMethods: PaymentMethodsService) {}

  @Get()
  findAll() {
    return this.paymentMethods.findAll();
  }

  @Put()
  replaceAll(@Body() dto: PutPaymentMethodsDto) {
    return this.paymentMethods.replaceAll(dto);
  }
}
