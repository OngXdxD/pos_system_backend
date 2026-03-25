import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { TimeService } from './time.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';

@Controller('time')
export class TimeController {
  constructor(private readonly time: TimeService) {}

  @Post('clock-in')
  clockIn(@Body() dto: ClockInDto) {
    return this.time.clockIn(dto.employeeId);
  }

  @Post('clock-out')
  clockOut(@Body() dto: ClockOutDto) {
    return this.time.clockOut(dto.entryId);
  }

  @Get('entries')
  entries(
    @Headers('authorization') authorization: string | undefined,
    @Query('employeeId') employeeId?: string,
  ) {
    return this.time.listEntries(authorization, employeeId);
  }
}

