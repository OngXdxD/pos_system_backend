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
exports.TimeService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let TimeService = class TimeService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    toResponse(e) {
        return {
            id: e.id,
            employeeId: e.employeeId,
            clockInAt: e.clockInAt.toISOString(),
            clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
        };
    }
    async clockIn(employeeId) {
        const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
        if (!employee || !employee.isActive)
            throw new common_1.NotFoundException('Employee not found');
        const open = await this.prisma.timeEntry.findFirst({
            where: { employeeId, clockOutAt: null },
            orderBy: { clockInAt: 'desc' },
        });
        if (open)
            throw new common_1.BadRequestException('Employee is already clocked in');
        const entry = await this.prisma.timeEntry.create({
            data: {
                employeeId,
                clockInAt: new Date(),
            },
        });
        return this.toResponse(entry);
    }
    async clockOut(entryId) {
        const entry = await this.prisma.timeEntry.findUnique({ where: { id: entryId } });
        if (!entry)
            throw new common_1.NotFoundException('Time entry not found');
        if (entry.clockOutAt)
            throw new common_1.BadRequestException('Entry already clocked out');
        const updated = await this.prisma.timeEntry.update({
            where: { id: entryId },
            data: { clockOutAt: new Date() },
        });
        return this.toResponse(updated);
    }
    async listEntries(employeeId, limit = 50) {
        const entries = await this.prisma.timeEntry.findMany({
            where: { employeeId },
            orderBy: { clockInAt: 'desc' },
            take: limit,
        });
        return entries.map((e) => this.toResponse(e));
    }
};
exports.TimeService = TimeService;
exports.TimeService = TimeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], TimeService);
//# sourceMappingURL=time.service.js.map