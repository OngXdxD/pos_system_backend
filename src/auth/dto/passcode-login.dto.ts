import { IsString, Matches } from 'class-validator';

export class PasscodeLoginDto {
  @IsString()
  @Matches(/^\d{4}$/, { message: 'passcode must be a 4-digit string' })
  passcode!: string;
}
