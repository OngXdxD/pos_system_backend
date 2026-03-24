import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RefundOrderDto {
  @Transform(({ value }) => (value != null ? String(value) : value))
  @IsString()
  @Matches(/^\d{4}$/, { message: 'employeePasscode must be 4 digits' })
  employeePasscode!: string;
}
