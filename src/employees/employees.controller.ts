import { Body, Controller, Post } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ChangeEmployeePasscodeDto } from './dto/change-passcode.dto';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto) {
    return this.employees.create(dto);
  }

  @Post('change-passcode')
  changePasscode(@Body() dto: ChangeEmployeePasscodeDto) {
    return this.employees.changePasscode(dto);
  }
}

