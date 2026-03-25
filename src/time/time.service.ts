import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

type TimeEntryResponse = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  clockInAt: string;
  clockOutAt: string | null;
};

@Injectable()
export class TimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private toResponse(
    e: { id: string; employeeId: string; clockInAt: Date; clockOutAt: Date | null },
    employeeName: string | null,
  ): TimeEntryResponse {
    return {
      id: e.id,
      employeeId: e.employeeId,
      employeeName,
      clockInAt: e.clockInAt.toISOString(),
      clockOutAt: e.clockOutAt ? e.clockOutAt.toISOString() : null,
    };
  }

  async clockIn(employeeId: string): Promise<TimeEntryResponse> {
    const employee = await this.prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee || !employee.isActive) throw new NotFoundException('Employee not found');

    const open = await this.prisma.timeEntry.findFirst({
      where: { employeeId, clockOutAt: null },
      orderBy: { clockInAt: 'desc' },
    });
    if (open) throw new BadRequestException('Employee is already clocked in');

    const entry = await this.prisma.timeEntry.create({
      data: {
        employeeId,
        clockInAt: new Date(),
      },
      include: { employee: { select: { name: true } } },
    });
    return this.toResponse(entry, entry.employee?.name ?? null);
  }

  async clockOut(entryId: string): Promise<TimeEntryResponse> {
    const entry = await this.prisma.timeEntry.findUnique({
      where: { id: entryId },
      include: { employee: { select: { name: true } } },
    });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.clockOutAt) throw new BadRequestException('Entry already clocked out');

    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: { clockOutAt: new Date() },
      include: { employee: { select: { name: true } } },
    });
    return this.toResponse(updated, updated.employee?.name ?? null);
  }

  /**
   * With `employeeId`: that employee's entries (self or Super Admin).
   * Without `employeeId`: all staff entries, Super Admin only (§12).
   */
  async listEntries(authorizationHeader: string | undefined, employeeId?: string): Promise<TimeEntryResponse[]> {
    const viewer = await this.auth.authenticateBearer(authorizationHeader);

    const hasEmployeeFilter = employeeId !== undefined && employeeId !== '';

    if (hasEmployeeFilter) {
      if (viewer.role !== 'SUPER_ADMIN' && employeeId !== viewer.id) {
        throw new ForbiddenException('You may only view your own time entries');
      }
      const entries = await this.prisma.timeEntry.findMany({
        where: { employeeId },
        include: { employee: { select: { name: true } } },
        orderBy: { clockInAt: 'desc' },
        take: 500,
      });
      return entries.map((e) => this.toResponse(e, e.employee?.name ?? null));
    }

    if (viewer.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Super Admin only');
    }

    const entries = await this.prisma.timeEntry.findMany({
      include: { employee: { select: { name: true } } },
      orderBy: { clockInAt: 'desc' },
      take: 2000,
    });
    return entries.map((e) => this.toResponse(e, e.employee?.name ?? null));
  }
}
