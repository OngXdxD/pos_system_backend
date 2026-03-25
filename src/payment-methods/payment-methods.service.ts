import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { PutPaymentMethodsDto } from './dto/put-payment-methods.dto';
import { ensureDefaultPaymentMethods } from './ensure-default-payment-methods';

@Injectable()
export class PaymentMethodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async findAll() {
    await ensureDefaultPaymentMethods(this.prisma);
    const rows = await this.prisma.paymentMethod.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, code: true },
    });
    return rows;
  }

  async replaceAll(dto: PutPaymentMethodsDto) {
    await this.auth.verifySuperAdminPasscode(dto.superAdminPasscode);

    const codes = dto.methods.map((m) => m.code);
    const unique = new Set(codes);
    if (unique.size !== codes.length) {
      throw new BadRequestException('Duplicate payment method codes in payload');
    }

    await this.prisma.$transaction([
      this.prisma.paymentMethod.deleteMany({}),
      this.prisma.paymentMethod.createMany({
        data: dto.methods.map((m, i) => ({ code: m.code, label: m.label, sortOrder: i })),
      }),
    ]);

    return this.findAll();
  }
}
