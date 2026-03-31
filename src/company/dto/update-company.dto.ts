import { IsString, IsOptional, IsEmail, IsIn, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function pick<T extends Record<string, unknown>>(obj: T, camel: keyof T, snake: string): unknown {
  const o = obj as Record<string, unknown>;
  const c = o[camel as string];
  if (c !== undefined && c !== null) return c;
  return o[snake];
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'registerNumber', 'register_number'))
  @IsString()
  registerNumber?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'contactNumber', 'contact_number'))
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'address', 'address'))
  @IsString()
  address?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'email', 'email'))
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'thermalPaperWidth', 'thermal_paper_width'))
  @IsIn(['58', '80', ''])
  thermalPaperWidth?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'defaultPaymentMethodCode', 'default_payment_method_code'))
  @IsString()
  @MaxLength(64)
  defaultPaymentMethodCode?: string;

  @IsOptional()
  @Transform(({ obj }) => pick(obj, 'thermalPrinterQueueName', 'thermal_printer_queue_name'))
  @IsString()
  @MaxLength(255)
  thermalPrinterQueueName?: string;
}
