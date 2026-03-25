-- Session lookups by employee; order list by employee; menu active list; time ranges; nested order loads
CREATE INDEX "employee_sessions_employeeId_idx" ON "employee_sessions"("employeeId");
CREATE INDEX "orders_employeeId_idx" ON "orders"("employeeId");
CREATE INDEX "menu_items_isActive_name_idx" ON "menu_items"("isActive", "name");
CREATE INDEX "time_entries_employeeId_clockInAt_idx" ON "time_entries"("employeeId", "clockInAt");
CREATE INDEX "time_entries_clockInAt_idx" ON "time_entries"("clockInAt");
CREATE INDEX "order_lines_orderId_idx" ON "order_lines"("orderId");
CREATE INDEX "order_line_addons_orderLineId_idx" ON "order_line_addons"("orderLineId");
CREATE INDEX "payment_methods_sortOrder_idx" ON "payment_methods"("sortOrder");
CREATE INDEX "addon_groups_menuItemId_idx" ON "addon_groups"("menuItemId");
CREATE INDEX "addon_options_addOnGroupId_idx" ON "addon_options"("addOnGroupId");
