import { IsString, Matches, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class ChangeOrderPaymentDto {
  @Transform(({ value }) => (value != null ? String(value) : value))
  @IsString()
  @Matches(/^\d{4}$/, { message: 'employeePasscode must be 4 digits' })
  employeePasscode!: string;

  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'paymentMethod must match server catalog code' })
  paymentMethod!: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  paymentMethodDetail?: string;
}
