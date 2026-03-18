import { SalesService } from './sales.service';
export declare class SalesController {
    private readonly salesService;
    constructor(salesService: SalesService);
    getSummary(date?: string): Promise<import("../common/types").SalesSummaryDto | import("../common/types").SalesSummaryDto[]>;
}
