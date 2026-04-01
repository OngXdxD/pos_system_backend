-- §3: optional client order label (offline replay), e.g. OFF-AB12
ALTER TABLE "orders" ADD COLUMN "public_order_number" TEXT;
