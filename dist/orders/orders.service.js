"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const TAX_RATE = 0.1;
let OrdersService = class OrdersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    orderItemToDto(item) {
        return {
            id: item.id,
            productId: item.productId,
            name: item.name,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
        };
    }
    orderToDto(order) {
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            createdAt: order.createdAt.toISOString(),
            status: order.status,
            subtotal: order.subtotal,
            tax: order.tax,
            total: order.total,
            paymentMethod: order.paymentMethod,
            items: order.items.map((i) => this.orderItemToDto(i)),
        };
    }
    async getNextOrderNumber() {
        const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const last = await this.prisma.order.findFirst({
            where: { orderNumber: { startsWith: `ORD-${today}-` } },
            orderBy: { orderNumber: 'desc' },
        });
        const next = last ? parseInt(last.orderNumber.split('-')[2] ?? '0', 10) + 1 : 1;
        return `ORD-${today}-${String(next).padStart(4, '0')}`;
    }
    async create(dto) {
        const productIds = [...new Set(dto.items.map((i) => i.productId))];
        const products = await this.prisma.product.findMany({
            where: { id: { in: productIds }, isActive: true },
        });
        const productMap = new Map(products.map((p) => [p.id, p]));
        for (const id of productIds) {
            if (!productMap.has(id))
                throw new common_1.BadRequestException(`Product ${id} not found or inactive`);
        }
        let subtotal = 0;
        const orderItemsData = dto.items.map((item) => {
            const product = productMap.get(item.productId);
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
    async findAll(limit = 50, cursor) {
        const orders = await this.prisma.order.findMany({
            take: limit,
            ...(cursor && { cursor: { id: cursor }, skip: 1 }),
            orderBy: { createdAt: 'desc' },
            include: { items: true },
        });
        return orders.map((o) => this.orderToDto(o));
    }
    async findOne(id) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!order)
            throw new common_1.NotFoundException(`Order ${id} not found`);
        return this.orderToDto(order);
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map