-- AlterTable: human-readable order sequence (C001, C002, …)
ALTER TABLE "orders" ADD COLUMN "sequence" SERIAL NOT NULL;
ALTER TABLE "orders" ADD CONSTRAINT "orders_sequence_key" UNIQUE ("sequence");

-- AlterTable: cash tender / change
ALTER TABLE "orders" ADD COLUMN "tenderCents" INTEGER;
ALTER TABLE "orders" ADD COLUMN "changeDueCents" INTEGER;

-- CreateTable
CREATE TABLE "order_audit_events" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorEmployeeId" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_audit_events_orderId_idx" ON "order_audit_events"("orderId");

-- AddForeignKey
ALTER TABLE "order_audit_events" ADD CONSTRAINT "order_audit_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
