-- Status on new rows is set by API from autoCompleteNewOrders; DB default is PENDING
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'PENDING';
