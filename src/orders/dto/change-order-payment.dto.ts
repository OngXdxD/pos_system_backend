import { IsString, Matches, IsIn } from 'class-validator';
import { Transform } from 'class-transformer';
import { ORDER_PAYMENT_METHODS } from '../order-payment.constants';

export class ChangeOrderPaymentDto {
  @Transform(({ value }) => (value != null ? String(value) : value))
  @IsString()
  @Matches(/^\d{4}$/, { message: 'employeePasscode must be 4 digits' })
  employeePasscode!: string;

  @IsString()
  @IsIn([...ORDER_PAYMENT_METHODS])
  paymentMethod!: (typeof ORDER_PAYMENT_METHODS)[number];
}
