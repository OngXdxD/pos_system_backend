import type { PaymentMethod } from '../../common/types';
export declare class DraftOrderItemDto {
    productId: string;
    quantity: number;
}
export declare class CreateOrderDto {
    items: {
        productId: string;
        quantity: number;
    }[];
    paymentMethod: PaymentMethod;
}
