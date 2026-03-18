import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMenuItemDto, CreateAddOnGroupDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

type AddOnOptionRow = { id: string; name: string; price: number; sortOrder: number };
type AddOnGroupRow = { id: string; name: string; maxSelectable: number; sortOrder: number; options: AddOnOptionRow[] };
type MenuItemRow = { id: string; name: string; basePrice: number; isActive: boolean; addOnGroups: AddOnGroupRow[] };

const menuInclude = {
  addOnGroups: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      options: { orderBy: { sortOrder: 'asc' as const } },
    },
  },
};

function toDto(item: MenuItemRow) {
  return {
    id: item.id,
    name: item.name,
    basePrice: item.basePrice,
    isActive: item.isActive,
    addOnGroups: item.addOnGroups.map((g) => ({
      id: g.id,
      name: g.name,
      maxSelectable: g.maxSelectable,
      sortOrder: g.sortOrder,
      options: g.options.map((o) => ({
        id: o.id,
        name: o.name,
        price: o.price,
        sortOrder: o.sortOrder,
      })),
    })),
  };
}

function buildGroupsCreate(groups: CreateAddOnGroupDto[]) {
  return groups.map((g, gi) => ({
    name: g.name,
    maxSelectable: g.maxSelectable,
    sortOrder: g.sortOrder ?? gi,
    options: {
      create: (g.options ?? []).map((o, oi) => ({
        name: o.name,
        price: o.price,
        sortOrder: o.sortOrder ?? oi,
      })),
    },
  }));
}

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const items = await this.prisma.menuItem.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: menuInclude,
    });
    return items.map(toDto);
  }

  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({ where: { id }, include: menuInclude });
    if (!item || !item.isActive) throw new NotFoundException(`Menu item ${id} not found`);
    return toDto(item);
  }

  async create(dto: CreateMenuItemDto) {
    const item = await this.prisma.menuItem.create({
      data: {
        name: dto.name,
        basePrice: dto.basePrice,
        addOnGroups: {
          create: buildGroupsCreate(dto.addOnGroups ?? []),
        },
      },
      include: menuInclude,
    });
    return toDto(item);
  }

  async replace(id: string, dto: UpdateMenuItemDto) {
    await this.findOne(id);

    // Delete existing groups (cascades to options) then recreate from payload
    await this.prisma.addOnGroup.deleteMany({ where: { menuItemId: id } });

    const item = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.name != null && { name: dto.name }),
        ...(dto.basePrice != null && { basePrice: dto.basePrice }),
        addOnGroups: {
          create: buildGroupsCreate(dto.addOnGroups ?? []),
        },
      },
      include: menuInclude,
    });
    return toDto(item);
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    return { success: true };
  }
}
