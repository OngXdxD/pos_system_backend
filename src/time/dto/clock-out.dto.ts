import { IsUUID } from 'class-validator';

export class ClockOutDto {
  @IsUUID()
  entryId!: string;
}

