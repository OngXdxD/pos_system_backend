-- AlterTable
ALTER TABLE "orders" ADD COLUMN "paymentMethodDetail" TEXT;

-- CreateIndex (Reports: range filter on createdAt; composite for status + range)
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");
CREATE INDEX "orders_createdAt_status_idx" ON "orders"("createdAt", "status");
