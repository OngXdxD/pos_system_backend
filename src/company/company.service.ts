import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

const SINGLETON_ID = 'default';

type CompanyResponse = {
  companyName: string;
  registerNumber: string | null;
  contactNumber: string | null;
  address: string | null;
  email: string | null;
};

function toResponse(row: {
  companyName: string;
  registerNumber: string | null;
  contactNumber: string | null;
  address: string | null;
  email: string | null;
}): CompanyResponse {
  return {
    companyName: row.companyName,
    registerNumber: row.registerNumber,
    contactNumber: row.contactNumber,
    address: row.address,
    email: row.email,
  };
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<CompanyResponse> {
    const row = await this.prisma.companySetting.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) throw new NotFoundException('Company info not configured yet');
    return toResponse(row);
  }

  async upsert(dto: UpdateCompanyDto): Promise<CompanyResponse> {
    const row = await this.prisma.companySetting.upsert({
      where: { id: SINGLETON_ID },
      create: {
        id: SINGLETON_ID,
        companyName: dto.companyName,
        registerNumber: dto.registerNumber ?? null,
        contactNumber: dto.contactNumber ?? null,
        address: dto.address ?? null,
        email: dto.email ?? null,
      },
      update: {
        companyName: dto.companyName,
        registerNumber: dto.registerNumber ?? null,
        contactNumber: dto.contactNumber ?? null,
        address: dto.address ?? null,
        email: dto.email ?? null,
      },
    });
    return toResponse(row);
  }
}
