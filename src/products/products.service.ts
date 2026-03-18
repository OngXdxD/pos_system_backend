import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductDto } from '../common/types';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(p: { id: string; sku: string; name: string; price: number; isActive: boolean }): ProductDto {
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      price: p.price,
      isActive: p.isActive,
    };
  }

  async create(dto: CreateProductDto): Promise<ProductDto> {
    const existing = await this.prisma.product.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
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

  async findAll(activeOnly?: boolean): Promise<ProductDto[]> {
    const where = activeOnly === true ? { isActive: true } : {};
    const list = await this.prisma.product.findMany({ where, orderBy: { name: 'asc' } });
    return list.map(this.toDto);
  }

  async findOne(id: string): Promise<ProductDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return this.toDto(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductDto> {
    await this.findOne(id);
    if (dto.sku != null) {
      const existing = await this.prisma.product.findFirst({ where: { sku: dto.sku, NOT: { id } } });
      if (existing) throw new ConflictException(`Product with SKU "${dto.sku}" already exists`);
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

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
  }
}
