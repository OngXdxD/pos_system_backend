import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderPaymentDto } from './dto/change-order-payment.dto';

const orderInclude = {
  lines: {
    include: { addOns: true },
  },
};

type AddonRow = { id: string; optionId: string; optionName: string; price: number };
type LineRow = {
  id: string;
  menuItemId: string;
  menuItemName: string;
  basePrice: number;
  quantity: number;
  addOns: AddonRow[];
};
type OrderRow = {
  id: string;
  sequence: number;
  employeeId: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  tenderCents: number | null;
  changeDueCents: number | null;
  status: string;
  createdAt: Date;
  lines: LineRow[];
};

export function formatOrderNumber(sequence: number): string {
  return `C${String(sequence).padStart(3, '0')}`;
}

function mapLines(lines: LineRow[]) {
  return lines.map((l) => ({
    id: l.id,
    menuItemId: l.menuItemId,
    menuItemName: l.menuItemName,
    basePrice: l.basePrice,
    quantity: l.quantity,
    addOns: l.addOns.map((a) => ({
      optionId: a.optionId,
      optionName: a.optionName,
      price: a.price,
    })),
  }));
}

function toDto(o: OrderRow) {
  const lines = mapLines(o.lines);
  return {
    id: o.id,
    sequence: o.sequence,
    orderNumber: formatOrderNumber(o.sequence),
    employeeId: o.employeeId,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    tenderCents: o.tenderCents,
    changeDueCents: o.changeDueCents,
    status: o.status,
    createdAt: o.createdAt.toISOString(),
    lines,
    items: lines,
  };
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async create(dto: CreateOrderDto) {
    if (!dto.lines.length) throw new BadRequestException('Order must have at least one line');

    if (dto.paymentMethod !== 'CASH' && dto.tenderCents != null) {
      throw new BadRequestException('tenderCents is only valid when paymentMethod is CASH');
    }

    const employee = await this.prisma.employee.findUnique({ where: { id: dto.employeeId } });
    if (!employee || !employee.isActive) throw new NotFoundException('Employee not found');

    const menuItemIds = [...new Set(dto.lines.map((l) => l.menuItemId))];
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds }, isActive: true },
    });
    const menuMap = new Map(menuItems.map((m) => [m.id, m]));
    for (const id of menuItemIds) {
      if (!menuMap.has(id)) throw new BadRequestException(`Menu item ${id} not found or inactive`);
    }

    let subtotalCents = 0;
    for (const line of dto.lines) {
      const addOns = line.addOns ?? [];
      const lineTotal = line.basePrice * line.quantity;
      const addOnsTotal = addOns.reduce((sum, a) => sum + a.price, 0) * line.quantity;
      subtotalCents += lineTotal + addOnsTotal;
    }

    const discountCents = dto.discountCents ?? 0;
    const totalCents = Math.max(0, subtotalCents - discountCents);

    let tenderCents: number | null = null;
    let changeDueCents: number | null = null;
    if (dto.paymentMethod === 'CASH' && dto.tenderCents != null) {
      tenderCents = dto.tenderCents;
      changeDueCents = Math.max(0, tenderCents - totalCents);
    }

    const order = await this.prisma.order.create({
      data: {
        employeeId: dto.employeeId,
        subtotalCents,
        discountCents,
        totalCents,
        paymentMethod: dto.paymentMethod,
        tenderCents,
        changeDueCents,
        status: 'PENDING',
        lines: {
          create: dto.lines.map((line) => ({
            menuItemId: line.menuItemId,
            menuItemName: line.menuItemName,
            basePrice: line.basePrice,
            quantity: line.quantity,
            addOns: {
              create: (line.addOns ?? []).map((a) => ({
                optionId: a.optionId,
                optionName: a.optionName,
                price: a.price,
              })),
            },
          })),
        },
      },
      include: orderInclude,
    });

    return toDto(order as OrderRow);
  }

  async findAll(status?: string, employeeId?: string) {
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    const orders = await this.prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: orderInclude,
    });
    return orders.map((o) => toDto(o as OrderRow));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return toDto(order as OrderRow);
  }

  async getAudit(id: string) {
    await this.findOne(id);
    const events = await this.prisma.orderAuditEvent.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
    });
    return events.map((e) => ({
      id: e.id,
      orderId: e.orderId,
      action: e.action,
      actorEmployeeId: e.actorEmployeeId,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async refund(id: string, employeePasscode: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status === 'REFUNDED') {
      throw new ConflictException('Order is already refunded');
    }

    const actor = await this.auth.verifyAnyActiveEmployeePasscode(employeePasscode);

    await this.prisma.orderAuditEvent.create({
      data: {
        orderId: id,
        action: 'REFUND',
        actorEmployeeId: actor.id,
        payload: { previousStatus: order.status } as Prisma.InputJsonValue,
      },
    });

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: 'REFUNDED' },
      include: orderInclude,
    });

    return toDto(updated as OrderRow);
  }

  async changePaymentMethod(id: string, dto: ChangeOrderPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    if (order.status === 'REFUNDED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Cannot change payment method for this order');
    }

    const actor = await this.auth.verifyAnyActiveEmployeePasscode(dto.employeePasscode);
    const oldMethod = order.paymentMethod;

    await this.prisma.orderAuditEvent.create({
      data: {
        orderId: id,
        action: 'CHANGE_PAYMENT',
        actorEmployeeId: actor.id,
        payload: {
          oldPaymentMethod: oldMethod,
          newPaymentMethod: dto.paymentMethod,
        } as Prisma.InputJsonValue,
      },
    });

    const tenderUpdate =
      dto.paymentMethod === 'CASH'
        ? {}
        : { tenderCents: null, changeDueCents: null };

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        paymentMethod: dto.paymentMethod,
        ...tenderUpdate,
      },
      include: orderInclude,
    });

    return toDto(updated as OrderRow);
  }
}
