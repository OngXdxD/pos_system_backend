-- AlterTable
ALTER TABLE "orders" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH';
ALTER TABLE "orders" ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "subtotalCents" INTEGER NOT NULL DEFAULT 0;

-- Backfill: historical orders had totalCents only; treat as subtotal with no discount
UPDATE "orders" SET "subtotalCents" = "totalCents" WHERE "subtotalCents" = 0;
