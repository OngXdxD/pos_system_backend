import { IsString, IsArray, IsInt, Min, ValidateNested, IsOptional, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ORDER_PAYMENT_METHODS } from '../order-payment.constants';

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderLineDto)
  lines!: OrderLineDto[];

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? 0 : Number(value)))
  @IsInt()
  @Min(0)
  discountCents?: number;

  @IsString()
  @IsIn([...ORDER_PAYMENT_METHODS])
  paymentMethod!: (typeof ORDER_PAYMENT_METHODS)[number];

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null ? undefined : Number(value)))
  @IsInt()
  @Min(0)
  tenderCents?: number;
}
