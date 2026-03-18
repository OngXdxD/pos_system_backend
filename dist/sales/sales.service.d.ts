import { PrismaService } from '../prisma/prisma.service';
import type { SalesSummaryDto } from '../common/types';
export declare class SalesService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getSummary(date?: string): Promise<SalesSummaryDto | SalesSummaryDto[]>;
    private getSummaryForDate;
}
