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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = require("bcrypt");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../prisma/prisma.service");
const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_EXPIRY_HOURS = 24;
const JWT_EXPIRY = `${SESSION_EXPIRY_HOURS}h`;
let AuthService = class AuthService {
    constructor(prisma, jwt) {
        this.prisma = prisma;
        this.jwt = jwt;
    }
    hashToken(token) {
        return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
    }
    async isLockedOut(identifier) {
        const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
        const failed = await this.prisma.authLoginAttempt.count({
            where: {
                identifier,
                success: false,
                createdAt: { gte: since },
            },
        });
        if (failed < MAX_FAILED_ATTEMPTS)
            return { locked: false };
        const oldest = await this.prisma.authLoginAttempt.findFirst({
            where: { identifier, success: false, createdAt: { gte: since } },
            orderBy: { createdAt: 'asc' },
        });
        const retryAfterMs = oldest
            ? Math.max(0, oldest.createdAt.getTime() + LOCKOUT_WINDOW_MS - Date.now())
            : LOCKOUT_WINDOW_MS;
        return { locked: true, retryAfterMs };
    }
    async recordAttempt(identifier, success) {
        await this.prisma.authLoginAttempt.create({
            data: { identifier, success },
        });
    }
    async passcodeLogin(passcode, identifier) {
        const lock = await this.isLockedOut(identifier);
        if (lock.locked) {
            throw new common_1.UnauthorizedException('Too many failed attempts. Try again later.');
        }
        const employeesWithPasscodes = await this.prisma.employee.findMany({
            where: { isActive: true },
            include: { passcode: true },
        });
        const matched = await this.findMatchingEmployee(employeesWithPasscodes, passcode);
        if (!matched) {
            await this.recordAttempt(identifier, false);
            throw new common_1.UnauthorizedException('Invalid passcode');
        }
        await this.recordAttempt(identifier, true);
        const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);
        const session = await this.prisma.employeeSession.create({
            data: {
                employeeId: matched.id,
                tokenHash: '',
                expiresAt,
            },
        });
        const payload = {
            sub: matched.id,
            sessionId: session.id,
            exp: Math.floor(expiresAt.getTime() / 1000),
        };
        const token = this.jwt.sign(payload, { expiresIn: JWT_EXPIRY });
        await this.prisma.employeeSession.update({
            where: { id: session.id },
            data: { tokenHash: this.hashToken(token) },
        });
        return {
            token,
            user: {
                id: matched.id,
                name: matched.name,
                role: matched.role,
            },
        };
    }
    async hashPasscode(passcode) {
        return bcrypt.hash(passcode, SALT_ROUNDS);
    }
    async verifySuperAdminPasscode(passcode) {
        const superAdmins = await this.prisma.employee.findMany({
            where: { isActive: true, role: 'SUPER_ADMIN' },
            include: { passcode: true },
        });
        const matched = await this.findMatchingEmployee(superAdmins, passcode);
        if (!matched)
            throw new common_1.ForbiddenException('Invalid super admin passcode');
    }
    async findMatchingEmployee(employees, passcode) {
        for (const e of employees) {
            if (!e.passcode)
                continue;
            const ok = await bcrypt.compare(passcode, e.passcode.passcodeHash);
            if (ok)
                return { id: e.id, name: e.name, role: e.role };
        }
        return null;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map