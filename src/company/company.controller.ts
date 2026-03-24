import { Body, Controller, Get, Put } from '@nestjs/common';
import { CompanyService } from './company.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('company')
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Get()
  get() {
    return this.company.get();
  }

  @Put()
  upsert(@Body() dto: UpdateCompanyDto) {
    return this.company.upsert(dto);
  }
}
