import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import type { OrderDto } from '../common/types';
export declare class OrdersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private orderItemToDto;
    private orderToDto;
    private getNextOrderNumber;
    create(dto: CreateOrderDto): Promise<OrderDto>;
    findAll(limit?: number, cursor?: string): Promise<OrderDto[]>;
    findOne(id: string): Promise<OrderDto>;
}
