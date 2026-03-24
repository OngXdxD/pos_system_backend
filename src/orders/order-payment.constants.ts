export const ORDER_PAYMENT_METHODS = ['CASH', 'CARD', 'OTHER'] as const;
export type OrderPaymentMethod = (typeof ORDER_PAYMENT_METHODS)[number];
