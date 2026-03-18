import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TimeEntryResponse = {
  id: string;
  employeeId: string;
  clockInAt: string;
  clockOutAt: string | null;
};

@Injectable()
export class TimeService {
  constructor(private readonly prisma: PrismaService) {}

  private toResponse(e: { id: string; employeeId: string; clockInAt: Date; clockOutAt: Date | null }): TimeEntryResponse {
    return {
      id: e.id,
      employeeId: e.employeeId,
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
    });
    return this.toResponse(entry);
  }

  async clockOut(entryId: string): Promise<TimeEntryResponse> {
    const entry = await this.prisma.timeEntry.findUnique({ where: { id: entryId } });
    if (!entry) throw new NotFoundException('Time entry not found');
    if (entry.clockOutAt) throw new BadRequestException('Entry already clocked out');

    const updated = await this.prisma.timeEntry.update({
      where: { id: entryId },
      data: { clockOutAt: new Date() },
    });
    return this.toResponse(updated);
  }

  async listEntries(employeeId: string, limit = 50): Promise<TimeEntryResponse[]> {
    const entries = await this.prisma.timeEntry.findMany({
      where: { employeeId },
      orderBy: { clockInAt: 'desc' },
      take: limit,
    });
    return entries.map((e) => this.toResponse(e));
  }
}

