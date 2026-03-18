import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
export declare class ProductsController {
    private readonly productsService;
    constructor(productsService: ProductsService);
    create(createProductDto: CreateProductDto): Promise<import("../common/types").ProductDto>;
    findAll(active?: string): Promise<import("../common/types").ProductDto[]>;
    findOne(id: string): Promise<import("../common/types").ProductDto>;
    update(id: string, updateProductDto: UpdateProductDto): Promise<import("../common/types").ProductDto>;
    remove(id: string): Promise<void>;
}
