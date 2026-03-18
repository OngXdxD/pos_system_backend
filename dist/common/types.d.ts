export type OrderStatus = 'PENDING_SYNC' | 'SYNCED';
export type PaymentMethod = 'CASH' | 'CARD' | 'OTHER';
export interface ProductDto {
    id: string;
    sku: string;
    name: string;
    price: number;
    isActive: boolean;
}
export interface OrderItemDto {
    id: string;
    productId: string;
    name: string;
    unitPrice: number;
    quantity: number;
}
export interface OrderDto {
    id: string;
    orderNumber: string;
    createdAt: string;
    status: OrderStatus;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: PaymentMethod;
    items: OrderItemDto[];
}
export interface DraftOrderItemDto {
    productId: string;
    quantity: number;
}
export interface DraftOrderDto {
    items: DraftOrderItemDto[];
    paymentMethod: PaymentMethod;
}
export interface SalesSummaryDto {
    date: string;
    totalSales: number;
    totalOrders: number;
    averageTicket: number;
}
