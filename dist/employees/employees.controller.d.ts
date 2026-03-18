import { EmployeesService } from './employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ChangeEmployeePasscodeDto } from './dto/change-passcode.dto';
export declare class EmployeesController {
    private readonly employees;
    constructor(employees: EmployeesService);
    findAll(): Promise<{
        id: string;
        name: string;
        role: string;
    }[]>;
    create(dto: CreateEmployeeDto): Promise<{
        id: string;
        createdAt: Date;
        name: string;
        role: string;
        isActive: boolean;
        updatedAt: Date;
    }>;
    changePasscode(dto: ChangeEmployeePasscodeDto): Promise<{
        success: boolean;
    }>;
}
