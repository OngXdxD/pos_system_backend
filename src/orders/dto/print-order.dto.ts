import { IsIn } from 'class-validator';

export class PrintOrderDto {
  @IsIn(['receipt', 'kitchen', 'both'])
  variant!: 'receipt' | 'kitchen' | 'both';
}
