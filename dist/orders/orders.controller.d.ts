import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
export declare class OrdersController {
    private readonly ordersService;
    constructor(ordersService: OrdersService);
    create(createOrderDto: CreateOrderDto): Promise<import("../common/types").OrderDto>;
    findAll(limit?: string, cursor?: string): Promise<import("../common/types").OrderDto[]>;
    findOne(id: string): Promise<import("../common/types").OrderDto>;
}
