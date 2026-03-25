-- New orders default to COMPLETED at DB level (matches application create)
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';
