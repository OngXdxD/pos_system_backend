import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_EXPIRY_HOURS = 24;
const JWT_EXPIRY = `${SESSION_EXPIRY_HOURS}h`;

export type AuthUser = { id: string; name: string; role: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async isLockedOut(identifier: string): Promise<{ locked: boolean; retryAfterMs?: number }> {
    const since = new Date(Date.now() - LOCKOUT_WINDOW_MS);
    const failed = await this.prisma.authLoginAttempt.count({
      where: {
        identifier,
        success: false,
        createdAt: { gte: since },
      },
    });
    if (failed < MAX_FAILED_ATTEMPTS) return { locked: false };
    const oldest = await this.prisma.authLoginAttempt.findFirst({
      where: { identifier, success: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
    const retryAfterMs = oldest
      ? Math.max(0, oldest.createdAt.getTime() + LOCKOUT_WINDOW_MS - Date.now())
      : LOCKOUT_WINDOW_MS;
    return { locked: true, retryAfterMs };
  }

  async recordAttempt(identifier: string, success: boolean): Promise<void> {
    await this.prisma.authLoginAttempt.create({
      data: { identifier, success },
    });
  }

  async passcodeLogin(passcode: string, identifier: string): Promise<{ token: string; user: AuthUser }> {
    const normalizedPasscode = String(passcode ?? '').trim();

    const lock = await this.isLockedOut(identifier);
    if (lock.locked && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException(
        'Too many failed attempts. Try again later.',
      );
    }

    const employeesWithPasscodes = await this.prisma.employee.findMany({
      where: { isActive: true },
      include: { passcode: true },
    });

    console.log(`[Auth] Found ${employeesWithPasscodes.length} active employees`);
    console.log(`[Auth] Employees with passcodes:`, employeesWithPasscodes.map(e => ({ id: e.id, name: e.name, hasPasscode: !!e.passcode })));

    const matched = await this.findMatchingEmployee(employeesWithPasscodes, normalizedPasscode);

    if (!matched) {
      await this.recordAttempt(identifier, false);
      throw new UnauthorizedException(
        'Invalid passcode. Ensure the database is seeded (npx prisma db seed) and employees exist.',
      );
    }

    await this.recordAttempt(identifier, true);

    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    const session = await this.prisma.employeeSession.create({
      data: {
        employeeId: matched.id,
        tokenHash: '', // set after JWT is created
        expiresAt,
      },
    });

    const payload = {
      sub: matched.id,
      sessionId: session.id,
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

  async hashPasscode(passcode: string): Promise<string> {
    return bcrypt.hash(passcode, SALT_ROUNDS);
  }

  async verifySuperAdminPasscode(passcode: string): Promise<void> {
    const superAdmins = await this.prisma.employee.findMany({
      where: { isActive: true, role: 'SUPER_ADMIN' },
      include: { passcode: true },
    });
    const matched = await this.findMatchingEmployee(superAdmins, passcode);
    if (!matched) throw new ForbiddenException('Invalid super admin passcode');
  }

  private async findMatchingEmployee(
    employees: { id: string; name: string; role: string; passcode: { passcodeHash: string } | null }[],
    passcode: string,
  ): Promise<{ id: string; name: string; role: string } | null> {
    for (const e of employees) {
      if (!e.passcode) continue;
      const ok = await bcrypt.compare(passcode, e.passcode.passcodeHash);
      if (ok) return { id: e.id, name: e.name, role: e.role };
    }
    return null;
  }
}
