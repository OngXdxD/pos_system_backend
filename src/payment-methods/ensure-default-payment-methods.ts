import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_ROWS = [
  { code: 'CASH', label: 'Cash', sortOrder: 0 },
  { code: 'CARD', label: 'Card', sortOrder: 1 },
  { code: 'OTHER', label: 'Other', sortOrder: 2 },
] as const;

/** If the catalog is empty (e.g. migrate ran but seed did not), insert CASH/CARD/OTHER. */
export async function ensureDefaultPaymentMethods(prisma: PrismaService): Promise<void> {
  const exists = await prisma.paymentMethod.findFirst({ select: { id: true } });
  if (exists) return;
  for (const row of DEFAULT_ROWS) {
    await prisma.paymentMethod.upsert({
      where: { code: row.code },
      create: { code: row.code, label: row.label, sortOrder: row.sortOrder },
      update: { label: row.label, sortOrder: row.sortOrder },
    });
  }
}
