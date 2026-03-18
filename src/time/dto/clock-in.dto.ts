import { IsUUID } from 'class-validator';

export class ClockInDto {
  @IsUUID()
  employeeId!: string;
}

