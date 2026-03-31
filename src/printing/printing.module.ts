import { Module } from '@nestjs/common';
import { ThermalPrintService } from './thermal-print.service';

@Module({
  providers: [ThermalPrintService],
  exports: [ThermalPrintService],
})
export class PrintingModule {}
