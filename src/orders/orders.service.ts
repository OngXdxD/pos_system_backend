import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { OrderDto, OrderItemDto, OrderStatus } from '../common/types';

const TAX_RATE = 0.1; // 10% for example

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  private orderItemToDto(item: { id: string; productId: string; name: string; unitPrice: number; quantity: number }): OrderItemDto {
    return {
      id: item.id,
      productId: item.productId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
    };
  }

  private orderToDto(order: {
    id: string;
    orderNumber: string;
    createdAt: Date;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    items: { id: string; productId: string; name: string; unitPrice: number; quantity: number }[];
  }): OrderDto {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt.toISOString(),
      status: order.status as OrderStatus,
      subtotal: order.subtotal,
      tax: order.tax,
      total: order.total,
      paymentMethod: order.paymentMethod as OrderDto['paymentMethod'],
      items: order.items.map((i) => this.orderItemToDto(i)),
    };
  }

  private async getNextOrderNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const last = await this.prisma.order.findFirst({
      where: { orderNumber: { startsWith: `ORD-${today}-` } },
      orderBy: { orderNumber: 'desc' },
    });
    const next = last ? parseInt(last.orderNumber.split('-')[2] ?? '0', 10) + 1 : 1;
    return `ORD-${today}-${String(next).padStart(4, '0')}`;
  }

  async create(dto: CreateOrderDto): Promise<OrderDto> {
    const productIds = [...new Set(dto.items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const id of productIds) {
      if (!productMap.has(id)) throw new BadRequestException(`Product ${id} not found or inactive`);
    }

    let subtotal = 0;
    const orderItemsData = dto.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPrice = product.price;
      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      return {
        productId: product.id,
        name: product.name,
        unitPrice,
        quantity: item.quantity,
      };
    });

    const tax = Math.round(subtotal * TAX_RATE);
    const total = subtotal + tax;
    const orderNumber = await this.getNextOrderNumber();

    const order = await this.prisma.order.create({
      data: {
        orderNumber,
        status: 'SYNCED',
        subtotal,
        tax,
        total,
        paymentMethod: dto.paymentMethod,
        items: {
          create: orderItemsData,
        },
      },
      include: { items: true },
    });

    return this.orderToDto(order);
  }

  async findAll(limit = 50, cursor?: string): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      take: limit,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return orders.map((o) => this.orderToDto(o));
  }

  async findOne(id: string): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return this.orderToDto(order);
  }
}
