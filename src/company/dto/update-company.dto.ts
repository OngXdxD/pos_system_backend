import { IsString, IsOptional, IsEmail } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  companyName!: string;

  @IsOptional()
  @IsString()
  registerNumber?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
