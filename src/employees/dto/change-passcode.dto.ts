import { IsString, IsUUID, Matches } from 'class-validator';

export class ChangeEmployeePasscodeDto {
  @IsUUID()
  employeeId!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'newPasscode must be a 4-digit string' })
  newPasscode!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'superAdminPasscode must be a 4-digit string' })
  superAdminPasscode!: string;
}

