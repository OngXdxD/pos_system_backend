-- Drop legacy tables (order matters due to FK dependencies)
DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "products";
DROP TABLE IF EXISTS "user_passcodes";
DROP TABLE IF EXISTS "auth_sessions";
DROP TABLE IF EXISTS "auth_login_attempts";
DROP TABLE IF EXISTS "users";

-- Rename pos_order_line_addons → order_line_addons
ALTER TABLE "pos_order_line_addons" RENAME CONSTRAINT "pos_order_line_addons_pkey" TO "order_line_addons_pkey";
ALTER TABLE "pos_order_line_addons" RENAME CONSTRAINT "pos_order_line_addons_orderLineId_fkey" TO "order_line_addons_orderLineId_fkey";
ALTER TABLE "pos_order_line_addons" RENAME TO "order_line_addons";

-- Rename pos_order_lines → order_lines
ALTER TABLE "pos_order_lines" RENAME CONSTRAINT "pos_order_lines_pkey" TO "order_lines_pkey";
ALTER TABLE "pos_order_lines" RENAME CONSTRAINT "pos_order_lines_orderId_fkey" TO "order_lines_orderId_fkey";
ALTER TABLE "pos_order_lines" RENAME TO "order_lines";

-- Rename pos_orders → orders
ALTER TABLE "pos_orders" RENAME CONSTRAINT "pos_orders_pkey" TO "orders_pkey";
ALTER TABLE "pos_orders" RENAME CONSTRAINT "pos_orders_employeeId_fkey" TO "orders_employeeId_fkey";
ALTER TABLE "pos_orders" RENAME TO "orders";
