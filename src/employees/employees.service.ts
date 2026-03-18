import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ChangeEmployeePasscodeDto } from './dto/change-passcode.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(dto: CreateEmployeeDto) {
    const passcodeHash = await this.auth.hashPasscode(dto.passcode);
    const employee = await this.prisma.employee.create({
      data: {
        name: dto.name,
        role: dto.role,
        isActive: true,
        passcode: { create: { passcodeHash } },
      },
      select: { id: true, name: true, role: true, isActive: true, createdAt: true, updatedAt: true },
    });
    return employee;
  }

  async findAll() {
    return this.prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
  }

  async changePasscode(dto: ChangeEmployeePasscodeDto) {
    await this.auth.verifySuperAdminPasscode(dto.superAdminPasscode);

    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee) throw new NotFoundException('Employee not found');

    const passcodeHash = await this.auth.hashPasscode(dto.newPasscode);
    await this.prisma.employeePasscode.upsert({
      where: { employeeId: dto.employeeId },
      create: { employeeId: dto.employeeId, passcodeHash },
      update: { passcodeHash, passcodeUpdatedAt: new Date() },
    });

    return { success: true };
  }
}

