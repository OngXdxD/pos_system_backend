import { ArrayMinSize, IsArray, IsString, Matches, MinLength, MaxLength, ValidateNested } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class PaymentMethodItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  label!: string;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'code must be uppercase letters, digits, underscores; start with a letter',
  })
  @MaxLength(32)
  code!: string;
}

export class PutPaymentMethodsDto {
  @Transform(({ value }) => (value != null ? String(value) : value))
  @IsString()
  @Matches(/^\d{4}$/, { message: 'superAdminPasscode must be 4 digits' })
  superAdminPasscode!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one payment method is required' })
  @ValidateNested({ each: true })
  @Type(() => PaymentMethodItemDto)
  methods!: PaymentMethodItemDto[];
}
