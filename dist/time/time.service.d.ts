import { PrismaService } from '../prisma/prisma.service';
type TimeEntryResponse = {
    id: string;
    employeeId: string;
    clockInAt: string;
    clockOutAt: string | null;
};
export declare class TimeService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private toResponse;
    clockIn(employeeId: string): Promise<TimeEntryResponse>;
    clockOut(entryId: string): Promise<TimeEntryResponse>;
    listEntries(employeeId: string, limit?: number): Promise<TimeEntryResponse[]>;
}
export {};
