import { Controller, Get, Query } from '@nestjs/common';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('summary')
  getSummary(@Query('date') date?: string) {
    return this.salesService.getSummary(date);
  }
}
