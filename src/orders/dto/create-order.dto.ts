import {
  IsString,
  IsArray,
  IsInt,
  Min,
  MaxLength,
  ValidateNested,
  IsOptional,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class OrderLineAddonDto {
  @IsString()
  optionId!: string;

  @IsString()
  optionName!: string;

  @IsInt()
  @Min(0)
  price!: number;
}

export class OrderLineDto {
  @IsString()
  menuItemId!: string;

  @IsString()
  menuItemName!: string;

  @IsInt()
  @Min(0)
  basePrice!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineAddonDto)
  addOns?: OrderLineAddonDto[];

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsString()
  employeeId!: string;

  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'paymentMethod must match server catalog code (e.g. CASH)' })
  paymentMethod!: string;

  /** Sub-method when `paymentMethod` is OTHER (e.g. TNG). Omit for CASH/CARD. */
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? undefined : String(value)))
  @IsString()
  @MaxLength(64)
  paymentMethodDetail?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  discountCents?: number;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  tenderCents?: number;

  /**
   * Settings → New orders: when true, status COMPLETED (paid at counter); when false or omitted, PENDING.
   */
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) return false;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return value;
  })
  @IsBoolean()
  autoCompleteNewOrders?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];
}
