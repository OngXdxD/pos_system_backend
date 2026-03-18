import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ChangeEmployeePasscodeDto } from './dto/change-passcode.dto';
export declare class EmployeesService {
    private readonly prisma;
    private readonly auth;
    constructor(prisma: PrismaService, auth: AuthService);
    create(dto: CreateEmployeeDto): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        role: string;
        isActive: boolean;
        updatedAt: Date;
    }>;
    findAll(): Promise<{
        id: string;
        name: string;
        role: string;
    }[]>;
    changePasscode(dto: ChangeEmployeePasscodeDto): Promise<{
        success: boolean;
    }>;
}
