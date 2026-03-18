import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductDto } from '../common/types';
export declare class ProductsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toDto;
    create(dto: CreateProductDto): Promise<ProductDto>;
    findAll(activeOnly?: boolean): Promise<ProductDto[]>;
    findOne(id: string): Promise<ProductDto>;
    update(id: string, dto: UpdateProductDto): Promise<ProductDto>;
    remove(id: string): Promise<void>;
}
