import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { SalesSummaryDto } from '../common/types';

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(date?: string): Promise<SalesSummaryDto | SalesSummaryDto[]> {
    if (date) {
      return this.getSummaryForDate(date);
    }
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const end = new Date();
    const results = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: 'SYNCED',
      },
      select: { createdAt: true, total: true },
    });

    const byDate = new Map<string, { totalSales: number; totalOrders: number }>();
    for (const o of results) {
      const d = o.createdAt.toISOString().slice(0, 10);
      const cur = byDate.get(d) ?? { totalSales: 0, totalOrders: 0 };
      cur.totalSales += o.total;
      cur.totalOrders += 1;
      byDate.set(d, cur);
    }

    const summaries: SalesSummaryDto[] = [];
    for (const [d, agg] of byDate.entries()) {
      summaries.push({
        date: d,
        totalSales: agg.totalSales,
        totalOrders: agg.totalOrders,
        averageTicket: agg.totalOrders > 0 ? Math.round(agg.totalSales / agg.totalOrders) : 0,
      });
    }
    summaries.sort((a, b) => a.date.localeCompare(b.date));
    return summaries;
  }

  private async getSummaryForDate(date: string): Promise<SalesSummaryDto> {
    const start = new Date(date + 'T00:00:00.000Z');
    const end = new Date(date + 'T23:59:59.999Z');
    const orders = await this.prisma.order.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        status: 'SYNCED',
      },
      select: { total: true },
    });
    const totalSales = orders.reduce((s, o) => s + o.total, 0);
    const totalOrders = orders.length;
    return {
      date,
      totalSales,
      totalOrders,
      averageTicket: totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0,
    };
  }
}
