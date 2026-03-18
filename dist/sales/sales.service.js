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
exports.SalesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let SalesService = class SalesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getSummary(date) {
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
        const byDate = new Map();
        for (const o of results) {
            const d = o.createdAt.toISOString().slice(0, 10);
            const cur = byDate.get(d) ?? { totalSales: 0, totalOrders: 0 };
            cur.totalSales += o.total;
            cur.totalOrders += 1;
            byDate.set(d, cur);
        }
        const summaries = [];
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
    async getSummaryForDate(date) {
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
};
exports.SalesService = SalesService;
exports.SalesService = SalesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SalesService);
//# sourceMappingURL=sales.service.js.map