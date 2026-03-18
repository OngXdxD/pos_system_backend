import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
export type AuthUser = {
    id: string;
    name: string;
    role: string;
};
export declare class AuthService {
    private readonly prisma;
    private readonly jwt;
    constructor(prisma: PrismaService, jwt: JwtService);
    private hashToken;
    isLockedOut(identifier: string): Promise<{
        locked: boolean;
        retryAfterMs?: number;
    }>;
    recordAttempt(identifier: string, success: boolean): Promise<void>;
    passcodeLogin(passcode: string, identifier: string): Promise<{
        token: string;
        user: AuthUser;
    }>;
    hashPasscode(passcode: string): Promise<string>;
    verifySuperAdminPasscode(passcode: string): Promise<void>;
    private findMatchingEmployee;
}
