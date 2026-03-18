import { IsString, Matches, IsIn } from 'class-validator';

const ROLES = ['SUPER_ADMIN', 'EMPLOYEE'] as const;

export class CreateEmployeeDto {
  @IsString()
  name!: string;

  @IsString()
  @Matches(/^\d{4}$/, { message: 'passcode must be a 4-digit string' })
  passcode!: string;

  @IsString()
  @IsIn(ROLES)
  role!: (typeof ROLES)[number];
}

