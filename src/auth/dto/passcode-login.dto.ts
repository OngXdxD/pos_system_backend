import { IsString, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class PasscodeLoginDto {
  @Transform(({ value }) => (value != null ? String(value) : value))
  @IsString()
  @Matches(/^\d{4}$/, { message: 'passcode must be 4 digits' })
  passcode!: string;
}
