import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ChangeOrderPaymentDto } from './dto/change-order-payment.dto';
import { ensureDefaultPaymentMethods } from '../payment-methods/ensure-default-payment-methods';
import { ThermalPrintService, OrderPrintPayload } from '../printing/thermal-print.service';

const orderInclude = {
  employee: { select: { name: true } },
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
  publicOrderNumber: string | null;
  employeeId: string;
  employee?: { name: string } | null;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  paymentMethod: string;
  paymentMethodDetail: string | null;
  tenderCents: number | null;
  changeDueCents: number | null;
  status: string;
  createdAt: Date;
  lines: LineRow[];
};

export function formatOrderNumber(sequence: number): string {
  return `C${String(sequence).padStart(3, '0')}`;
}

function apiOrderNumber(publicOrderNumber: string | null | undefined, sequence: number): string {
  const t = publicOrderNumber?.trim();
  if (t) return t;
  return formatOrderNumber(sequence);
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
  const cashier = o.employee?.name ?? null;
  return {
    id: o.id,
    sequence: o.sequence,
    orderNumber: apiOrderNumber(o.publicOrderNumber, o.sequence),
    employeeId: o.employeeId,
    employeeName: cashier,
    employee_name: cashier,
    cashierName: cashier,
    subtotalCents: o.subtotalCents,
    discountCents: o.discountCents,
    totalCents: o.totalCents,
    paymentMethod: o.paymentMethod,
    paymentMethodDetail: o.paymentMethodDetail ?? null,
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
  private readonly log = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly thermal: ThermalPrintService,
  ) {}

  private async assertPaymentMethodInCatalog(code: string): Promise<void> {
    await ensureDefaultPaymentMethods(this.prisma);
    const row = await this.prisma.paymentMethod.findUnique({
      where: { code },
      select: { code: true },
    });
    if (!row) throw new BadRequestException(`Unknown payment method: ${code}`);
  }

  async create(dto: CreateOrderDto) {
    if (!dto.lines.length) throw new BadRequestException('Order must have at least one line');

    await this.assertPaymentMethodInCatalog(dto.paymentMethod);

    const detailTrimmed = dto.paymentMethodDetail?.trim();
    if (dto.paymentMethod !== 'OTHER' && detailTrimmed) {
      throw new BadRequestException('paymentMethodDetail may only be set when paymentMethod is OTHER');
    }
    const paymentMethodDetail = dto.paymentMethod === 'OTHER' ? (detailTrimmed || null) : null;

    if (dto.paymentMethod !== 'CASH' && dto.tenderCents != null) {
      throw new BadRequestException('tenderCents is only valid when paymentMethod is CASH');
    }

    const menuItemIds = [...new Set(dto.lines.map((l) => l.menuItemId))];
    const [employee, menuItems] = await Promise.all([
      this.prisma.employee.findUnique({
        where: { id: dto.employeeId },
        select: { id: true, isActive: true },
      }),
      this.prisma.menuItem.findMany({
        where: { id: { in: menuItemIds }, isActive: true },
        select: { id: true },
      }),
    ]);
    if (!employee || !employee.isActive) throw new NotFoundException('Employee not found');
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

    const status = dto.autoCompleteNewOrders === true ? 'COMPLETED' : 'PENDING';

    const order = await this.prisma.order.create({
      data: {
        employeeId: dto.employeeId,
        publicOrderNumber: dto.orderNumber ?? null,
        subtotalCents,
        discountCents,
        totalCents,
        paymentMethod: dto.paymentMethod,
        paymentMethodDetail,
        tenderCents,
        changeDueCents,
        status,
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

    const body = toDto(order as OrderRow);
    // §9b: create responds after persist; optional inline print must not block the HTTP response.
    if (dto.printThermal === true) {
      void this.printAfterCreateNonBlocking(body as OrderPrintPayload);
    }
    return body;
  }

  /** Fire-and-forget thermal after create when client explicitly sends printThermal: true. */
  private async printAfterCreateNonBlocking(body: OrderPrintPayload): Promise<void> {
    try {
      const widthMm = await this.thermal.resolveWidthMm();
      const pr = await this.thermal.print(body, 'both', widthMm, true);
      if (pr.warning) {
        this.log.warn(`Thermal print after create (${body.id}): ${pr.warning}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.warn(`Thermal print after create failed (${body.id}): ${msg}`);
    }
  }

  /**
   * §9b Option B — requires `Authorization: Bearer` (same pattern as timesheet / employees).
   */
  async printThermal(
    id: string,
    variant: 'receipt' | 'kitchen' | 'both',
    authorizationHeader: string | undefined,
  ) {
    await this.auth.authenticateBearer(authorizationHeader);
    const order = await this.findOne(id);
    const widthMm = await this.thermal.resolveWidthMm();
    const r = await this.thermal.print(order as OrderPrintPayload, variant, widthMm, false);
    if (!r.ok) {
      throw new ConflictException(r.error ?? 'Thermal printer unavailable');
    }
    return { ok: true as const };
  }

  /**
   * §11: `from`/`to` filter `createdAt`; with `limit`, paginate in SQL and return `{ orders, total }`.
   * Without `limit`, return a plain array (reports / legacy clients).
   */
  async findAll(
    status?: string,
    employeeId?: string,
    fromIso?: string,
    toIso?: string,
    limitStr?: string,
    offsetStr?: string,
  ) {
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (employeeId) where.employeeId = employeeId;

    if (fromIso || toIso) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (fromIso) {
        const from = new Date(fromIso);
        if (Number.isNaN(from.getTime())) {
          throw new BadRequestException('Invalid from (expected ISO-8601 datetime)');
        }
        createdAt.gte = from;
      }
      if (toIso) {
        const to = new Date(toIso);
        if (Number.isNaN(to.getTime())) {
          throw new BadRequestException('Invalid to (expected ISO-8601 datetime)');
        }
        createdAt.lte = to;
      }
      where.createdAt = createdAt;
    }

    const ORDERS_MAX_LIMIT = 5000;
    const hasLimit = limitStr !== undefined && limitStr !== '';
    let take: number | undefined;
    if (hasLimit) {
      const n = parseInt(limitStr, 10);
      if (!Number.isFinite(n) || n < 1) {
        throw new BadRequestException('limit must be a positive integer');
      }
      take = Math.min(n, ORDERS_MAX_LIMIT);
    }

    let skip = 0;
    const hasOffset = offsetStr !== undefined && offsetStr !== '';
    if (hasOffset) {
      if (!hasLimit) {
        throw new BadRequestException('offset requires limit');
      }
      const off = parseInt(offsetStr, 10);
      if (!Number.isFinite(off) || off < 0) {
        throw new BadRequestException('offset must be a non-negative integer');
      }
      skip = off;
    }

    if (hasLimit) {
      const [total, orders] = await this.prisma.$transaction([
        this.prisma.order.count({ where }),
        this.prisma.order.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: orderInclude,
          skip,
          take: take!,
        }),
      ]);
      const mapped = orders.map((o) => toDto(o as OrderRow));
      return {
        orders: mapped,
        total,
        totalCount: total,
        total_count: total,
      };
    }

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
    const actorIds = [...new Set(events.map((e) => e.actorEmployeeId))];
    const actors =
      actorIds.length === 0
        ? []
        : await this.prisma.employee.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, name: true },
          });
    const nameById = new Map(actors.map((a) => [a.id, a.name]));
    return events.map((e) => ({
      id: e.id,
      orderId: e.orderId,
      action: e.action,
      actorEmployeeId: e.actorEmployeeId,
      actorName: nameById.get(e.actorEmployeeId) ?? null,
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
        payload: {
          previousStatus: order.status,
          actorName: actor.name,
        } as Prisma.InputJsonValue,
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
    const oldDetail = order.paymentMethodDetail;

    await this.assertPaymentMethodInCatalog(dto.paymentMethod);

    if (dto.paymentMethod !== 'OTHER' && dto.paymentMethodDetail != null && dto.paymentMethodDetail.trim() !== '') {
      throw new BadRequestException('paymentMethodDetail may only be set when paymentMethod is OTHER');
    }

    const newDetail =
      dto.paymentMethod === 'OTHER'
        ? dto.paymentMethodDetail !== undefined
          ? dto.paymentMethodDetail.trim() || null
          : oldDetail
        : null;

    await this.prisma.orderAuditEvent.create({
      data: {
        orderId: id,
        action: 'CHANGE_PAYMENT',
        actorEmployeeId: actor.id,
        payload: {
          oldPaymentMethod: oldMethod,
          newPaymentMethod: dto.paymentMethod,
          oldPaymentMethodDetail: oldDetail,
          newPaymentMethodDetail: newDetail,
          actorName: actor.name,
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
        paymentMethodDetail: newDetail,
        ...tenderUpdate,
      },
      include: orderInclude,
    });

    return toDto(updated as OrderRow);
  }
}
