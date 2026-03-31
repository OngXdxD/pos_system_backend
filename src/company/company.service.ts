import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

const SINGLETON_ID = 'default';
const MAX_QUEUE_NAME = 255;

type CompanyRow = {
  companyName: string;
  registerNumber: string | null;
  contactNumber: string | null;
  address: string | null;
  email: string | null;
  thermalPaperWidth: string | null;
  defaultPaymentMethodCode: string | null;
  thermalPrinterQueueName: string | null;
};

type CompanyResponse = {
  companyName: string;
  registerNumber: string | null;
  contactNumber: string | null;
  address: string | null;
  email: string | null;
  thermalPaperWidth: string | null;
  defaultPaymentMethodCode: string | null;
  thermalPrinterQueueName: string | null;
  thermal_paper_width: string | null;
  default_payment_method_code: string | null;
  thermal_printer_queue_name: string | null;
};

function toResponse(row: CompanyRow): CompanyResponse {
  const tw = row.thermalPaperWidth;
  const dc = row.defaultPaymentMethodCode;
  const tq = row.thermalPrinterQueueName;
  return {
    companyName: row.companyName,
    registerNumber: row.registerNumber,
    contactNumber: row.contactNumber,
    address: row.address,
    email: row.email,
    thermalPaperWidth: tw,
    defaultPaymentMethodCode: dc,
    thermalPrinterQueueName: tq,
    thermal_paper_width: tw,
    default_payment_method_code: dc,
    thermal_printer_queue_name: tq,
  };
}

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeThermal(v: string): string | null {
    const t = v.trim();
    if (t === '') return null;
    if (t !== '58' && t !== '80') {
      throw new BadRequestException('thermalPaperWidth must be "58", "80", or empty');
    }
    return t;
  }

  private normalizeDefaultPaymentCode(v: string | undefined): string | null | undefined {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t === '' ? null : t.slice(0, 64);
  }

  private normalizePrinterQueue(v: string | undefined): string | null | undefined {
    if (v === undefined) return undefined;
    const t = v.trim();
    return t === '' ? null : t.slice(0, MAX_QUEUE_NAME);
  }

  async get(): Promise<CompanyResponse> {
    const row = await this.prisma.companySetting.findUnique({ where: { id: SINGLETON_ID } });
    if (!row) throw new NotFoundException('Company info not configured yet');
    return toResponse(row as CompanyRow);
  }

  async upsert(dto: UpdateCompanyDto): Promise<CompanyResponse> {
    const existing = await this.prisma.companySetting.findUnique({ where: { id: SINGLETON_ID } });

    const keys = Object.keys(dto as object).filter((k) => (dto as Record<string, unknown>)[k] !== undefined);
    if (keys.length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    let thermal: string | null | undefined;
    if (dto.thermalPaperWidth !== undefined) {
      thermal = this.normalizeThermal(dto.thermalPaperWidth);
    }

    let defaultCode: string | null | undefined;
    if (dto.defaultPaymentMethodCode !== undefined) {
      defaultCode = this.normalizeDefaultPaymentCode(dto.defaultPaymentMethodCode);
    }

    let printerQueue: string | null | undefined;
    if (dto.thermalPrinterQueueName !== undefined) {
      printerQueue = this.normalizePrinterQueue(dto.thermalPrinterQueueName);
    }

    if (!existing) {
      if (!dto.companyName?.trim()) {
        throw new BadRequestException('companyName is required when company settings do not exist yet');
      }
      const row = await this.prisma.companySetting.create({
        data: {
          id: SINGLETON_ID,
          companyName: dto.companyName.trim(),
          registerNumber: dto.registerNumber?.trim() ?? null,
          contactNumber: dto.contactNumber?.trim() ?? null,
          address: dto.address?.trim() ?? null,
          email: dto.email?.trim() ?? null,
          thermalPaperWidth: thermal ?? null,
          defaultPaymentMethodCode: defaultCode ?? null,
          thermalPrinterQueueName: printerQueue ?? null,
        },
      });
      return toResponse(row as CompanyRow);
    }

    const data: Prisma.CompanySettingUpdateInput = {};
    if (dto.companyName !== undefined) {
      const n = dto.companyName.trim();
      if (!n) throw new BadRequestException('companyName cannot be empty');
      data.companyName = n;
    }
    if (dto.registerNumber !== undefined) {
      data.registerNumber = dto.registerNumber.trim() === '' ? null : dto.registerNumber.trim();
    }
    if (dto.contactNumber !== undefined) {
      data.contactNumber = dto.contactNumber.trim() === '' ? null : dto.contactNumber.trim();
    }
    if (dto.address !== undefined) {
      data.address = dto.address.trim() === '' ? null : dto.address.trim();
    }
    if (dto.email !== undefined) {
      data.email = dto.email.trim() === '' ? null : dto.email.trim();
    }
    if (dto.thermalPaperWidth !== undefined) {
      data.thermalPaperWidth = thermal ?? null;
    }
    if (dto.defaultPaymentMethodCode !== undefined) {
      data.defaultPaymentMethodCode = defaultCode ?? null;
    }
    if (dto.thermalPrinterQueueName !== undefined) {
      data.thermalPrinterQueueName = printerQueue ?? null;
    }

    if (Object.keys(data).length === 0) {
      return toResponse(existing as CompanyRow);
    }

    const row = await this.prisma.companySetting.update({
      where: { id: SINGLETON_ID },
      data,
    });
    return toResponse(row as CompanyRow);
  }
}
