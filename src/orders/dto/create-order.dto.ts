import { IsArray, IsEnum, ValidateNested, ArrayMinSize, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { PaymentMethod } from '../../common/types';

export class DraftOrderItemDto {
  @IsString()
  productId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftOrderItemDto)
  @ArrayMinSize(1, { message: 'At least one item is required' })
  items!: { productId: string; quantity: number }[];

  @IsEnum(['CASH', 'CARD', 'OTHER'])
  paymentMethod!: PaymentMethod;
}
