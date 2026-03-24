-- CreateTable
CREATE TABLE "pos_orders" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_lines" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "menuItemName" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "pos_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_order_line_addons" (
    "id" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,
    "optionName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "pos_order_line_addons_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "pos_orders" ADD CONSTRAINT "pos_orders_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_lines" ADD CONSTRAINT "pos_order_lines_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "pos_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_order_line_addons" ADD CONSTRAINT "pos_order_line_addons_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "pos_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
