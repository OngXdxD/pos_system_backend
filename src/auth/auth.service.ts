import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const SALT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const SESSION_EXPIRY_HOURS = 24;
const JWT_EXPIRY = `${SESSION_EXPIRY_HOURS}h`;

const failedAttempts = new Map<string, number[]>();

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

  /**
   * Validates `Authorization: Bearer <jwt>` and active session. Used for staff directory & timesheet APIs.
   */
  async authenticateBearer(authorizationHeader: string | undefined): Promise<AuthUser> {
    const raw = authorizationHeader?.trim();
    if (!raw?.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = raw.slice(7).trim();
    if (!token) throw new UnauthorizedException('Missing token');

    let payload: { sub: string; sessionId: string };
    try {
      payload = this.jwt.verify<{ sub: string; sessionId: string }>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const session = await this.prisma.employeeSession.findUnique({
      where: { id: payload.sessionId },
      select: {
        tokenHash: true,
        expiresAt: true,
        revokedAt: true,
        employee: { select: { id: true, name: true, role: true, isActive: true } },
      },
    });
    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session invalid or expired');
    }
    if (session.tokenHash !== this.hashToken(token)) {
      throw new UnauthorizedException('Session invalid');
    }
    if (!session.employee.isActive) {
      throw new UnauthorizedException('Employee inactive');
    }
    if (session.employee.id !== payload.sub) {
      throw new UnauthorizedException('Session invalid');
    }

    return {
      id: session.employee.id,
      name: session.employee.name,
      role: session.employee.role,
    };
  }

  private isLockedOut(identifier: string): { locked: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const cutoff = now - LOCKOUT_WINDOW_MS;
    const timestamps = (failedAttempts.get(identifier) ?? []).filter((t) => t > cutoff);
    failedAttempts.set(identifier, timestamps);

    if (timestamps.length < MAX_FAILED_ATTEMPTS) return { locked: false };
    const oldest = timestamps[0];
    return { locked: true, retryAfterMs: Math.max(0, oldest + LOCKOUT_WINDOW_MS - now) };
  }

  private recordFailedAttempt(identifier: string): void {
    const timestamps = failedAttempts.get(identifier) ?? [];
    timestamps.push(Date.now());
    failedAttempts.set(identifier, timestamps);
  }

  private clearAttempts(identifier: string): void {
    failedAttempts.delete(identifier);
  }

  async passcodeLogin(passcode: string, identifier: string): Promise<{ token: string; user: AuthUser }> {
    const normalizedPasscode = String(passcode ?? '').trim();

    const lock = this.isLockedOut(identifier);
    if (lock.locked && process.env.NODE_ENV === 'production') {
      throw new UnauthorizedException('Too many failed attempts. Try again later.');
    }

    const employeesWithPasscodes = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        passcode: { select: { passcodeHash: true } },
      },
    });

    const matched = await this.findMatchingEmployee(employeesWithPasscodes, normalizedPasscode);

    if (!matched) {
      this.recordFailedAttempt(identifier);
      throw new UnauthorizedException(
        'Invalid passcode. Ensure the database is seeded (npx prisma db seed) and employees exist.',
      );
    }

    this.clearAttempts(identifier);

    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    const session = await this.prisma.employeeSession.create({
      data: {
        employeeId: matched.id,
        tokenHash: '',
        expiresAt,
      },
    });

    const payload = { sub: matched.id, sessionId: session.id };
    const token = this.jwt.sign(payload, { expiresIn: JWT_EXPIRY });

    await this.prisma.employeeSession.update({
      where: { id: session.id },
      data: { tokenHash: this.hashToken(token) },
    });

    return {
      token,
      user: { id: matched.id, name: matched.name, role: matched.role },
    };
  }

  async hashPasscode(passcode: string): Promise<string> {
    return bcrypt.hash(passcode, SALT_ROUNDS);
  }

  async verifySuperAdminPasscode(passcode: string): Promise<void> {
    const superAdmins = await this.prisma.employee.findMany({
      where: { isActive: true, role: 'SUPER_ADMIN' },
      select: {
        id: true,
        name: true,
        role: true,
        passcode: { select: { passcodeHash: true } },
      },
    });
    const matched = await this.findMatchingEmployee(superAdmins, passcode);
    if (!matched) throw new ForbiddenException('Invalid super admin passcode');
  }

  /** Any active employee passcode (used for order refund / payment change authorization). */
  async verifyAnyActiveEmployeePasscode(passcode: string): Promise<{ id: string; name: string }> {
    const normalized = String(passcode ?? '').trim();
    const employees = await this.prisma.employee.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        passcode: { select: { passcodeHash: true } },
      },
    });
    const matched = await this.findMatchingEmployee(employees, normalized);
    if (!matched) throw new UnauthorizedException('Invalid passcode');
    return { id: matched.id, name: matched.name };
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
