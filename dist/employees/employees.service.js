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
exports.EmployeesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const auth_service_1 = require("../auth/auth.service");
let EmployeesService = class EmployeesService {
    constructor(prisma, auth) {
        this.prisma = prisma;
        this.auth = auth;
    }
    async create(dto) {
        const passcodeHash = await this.auth.hashPasscode(dto.passcode);
        const employee = await this.prisma.employee.create({
            data: {
                name: dto.name,
                role: dto.role,
                isActive: true,
                passcode: { create: { passcodeHash } },
            },
            select: { id: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
        });
        return employee;
    }
    async changePasscode(dto) {
        await this.auth.verifySuperAdminPasscode(dto.superAdminPasscode);
        const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
        if (!employee)
            throw new common_1.NotFoundException('Employee not found');
        const passcodeHash = await this.auth.hashPasscode(dto.newPasscode);
        await this.prisma.employeePasscode.upsert({
            where: { employeeId: dto.employeeId },
            create: { employeeId: dto.employeeId, passcodeHash },
            update: { passcodeHash, passcodeUpdatedAt: new Date() },
        });
        return { success: true };
    }
};
exports.EmployeesService = EmployeesService;
exports.EmployeesService = EmployeesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        auth_service_1.AuthService])
], EmployeesService);
//# sourceMappingURL=employees.service.js.map