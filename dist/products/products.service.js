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
exports.ProductsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ProductsService = class ProductsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toDto(p) {
        return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            price: p.price,
            isActive: p.isActive,
        };
    }
    async create(dto) {
        const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
        if (existing)
            throw new common_1.ConflictException(`Product with SKU "${dto.sku}" already exists`);
        const product = await this.prisma.product.create({
            data: {
                sku: dto.sku,
                name: dto.name,
                price: Math.round(dto.price),
                isActive: dto.isActive ?? true,
            },
        });
        return this.toDto(product);
    }
    async findAll(activeOnly) {
        const where = activeOnly === true ? { isActive: true } : {};
        const list = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
        return list.map(this.toDto);
    }
    async findOne(id) {
        const product = await this.prisma.product.findUnique({ where: { id } });
        if (!product)
            throw new common_1.NotFoundException(`Product ${id} not found`);
        return this.toDto(product);
    }
    async update(id, dto) {
        await this.findOne(id);
        if (dto.sku != null) {
            const existing = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
            if (existing)
                throw new common_1.ConflictException(`Product with SKU "${dto.sku}" already exists`);
        }
        const product = await this.prisma.product.update({
            where: { id },
            data: {
                ...(dto.sku != null && { sku: dto.sku }),
                ...(dto.name != null && { name: dto.name }),
                ...(dto.price != null && { price: Math.round(dto.price) }),
                ...(dto.isActive != null && { isActive: dto.isActive }),
            },
        });
        return this.toDto(product);
    }
    async remove(id) {
        await this.findOne(id);
        await this.prisma.product.delete({ where: { id } });
    }
};
exports.ProductsService = ProductsService;
exports.ProductsService = ProductsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ProductsService);
//# sourceMappingURL=products.service.js.map