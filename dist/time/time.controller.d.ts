import { TimeService } from './time.service';
import { ClockInDto } from './dto/clock-in.dto';
import { ClockOutDto } from './dto/clock-out.dto';
export declare class TimeController {
    private readonly time;
    constructor(time: TimeService);
    clockIn(dto: ClockInDto): Promise<{
        id: string;
        employeeId: string;
        clockInAt: string;
        clockOutAt: string | null;
    }>;
    clockOut(dto: ClockOutDto): Promise<{
        id: string;
        employeeId: string;
        clockInAt: string;
        clockOutAt: string | null;
    }>;
    entries(employeeId: string): Promise<{
        id: string;
        employeeId: string;
        clockInAt: string;
        clockOutAt: string | null;
    }[]>;
}
