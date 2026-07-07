import {
  AggregatorConfig, AuditEntry, Campaign, ClockEvent, Combo, Coupon, Customer, CustomerFeedback,
  DeliveryOrder, Employee, GoodsReceipt, InventoryItem, InventoryMovement, KOT, LedgerEntry,
  LoyaltyConfig, MenuCategory, MenuItem, MessageTemplate, Order, Outlet, PrepLog,
  PrepTask, PurchaseOrder, Recipe, Reservation, Rider, RolePolicy, ShiftAssignment, Supplier, Table, Tip,
  VendorPayout, WaitlistEntry, WastageEntry, Zone,
} from "@workspace/db";

const paise = (value: unknown) => Math.round(Number(value || 0) * 100);
const date = (value: unknown) => value == null ? undefined : new Date(typeof value === "number" || typeof value === "string" ? value : String(value));
const rows = (value: unknown): Record<string, any>[] => Array.isArray(value) ? value : [];

async function replace(model: any, outletId: string, value: unknown, map: (row: any) => Record<string, unknown>) {
  const source = rows(value);
  const ids = source.map((row) => String(row.id ?? row.code ?? row.source ?? row.role)).filter(Boolean);
  await model.deleteMany({ outletId, legacyId: { $nin: ids } });
  if (source.length) await model.bulkWrite(source.map((row) => {
    const legacyId = String(row.id ?? row.code ?? row.source ?? row.role);
    return { updateOne: { filter: { outletId, legacyId }, update: { $set: { ...map(row), clientPayload: row }, $setOnInsert: { outletId, legacyId } }, upsert: true } };
  }));
}

async function upsertOnly(model: any, outletId: string, value: unknown, map: (row: any) => Record<string, unknown>) {
  const source = rows(value);
  if (source.length) await model.bulkWrite(source.map((row) => {
    const legacyId = String(row.id ?? row.code ?? row.source ?? row.role);
    return { updateOne: { filter: { outletId, legacyId }, update: { $set: { ...map(row), clientPayload: row }, $setOnInsert: { outletId, legacyId } }, upsert: true } };
  }));
}

async function projectTables(outletId: string, key: string, value: unknown) {
  if (key === "table_zones") {
    const zones = rows(value);
    const ids = zones.map((z) => z.id);
    await Zone.deleteMany({ outletId, legacyId: { $nin: ids } });
    for (const z of zones) await Zone.updateOne({ outletId, legacyId: z.id }, { $set: { label: z.name, color: z.color, sortOrder: z.sortOrder, clientPayload: z }, $setOnInsert: { outletId, legacyId: z.id } }, { upsert: true });
    return;
  }
  if (key === "table_master") {
    const masters = rows(value);
    const zoneDocs = await Zone.find({ outletId }).lean() as any[];
    const zoneByLegacy = new Map(zoneDocs.map((z) => [z.legacyId, z]));
    for (const master of masters) {
      const zone = zoneByLegacy.get(master.zone);
      await Table.updateOne({ outletId, legacyId: master.id }, { $set: { zoneId: zone?._id, zoneLegacyId: master.zone, capacity: master.capacity, type: master.type, isActive: master.isActive, qrCode: master.qrCode, x: master.x, y: master.y, adminView: master }, $setOnInsert: { outletId, legacyId: master.id, status: master.isActive ? "Vacant" : "Maintenance" } }, { upsert: true });
    }
    return;
  }
  if (key === "foh_tables") {
    for (const live of rows(value)) await Table.updateOne({ outletId, legacyId: live.id }, { $set: { status: live.status, pax: live.pax, waiterName: live.waiterName, customerName: live.customerName, occupiedSince: date(live.occupiedSince), capacity: live.capacity, fohView: live }, $setOnInsert: { outletId, legacyId: live.id } }, { upsert: true });
    return;
  }
  const map = value as Record<string, any>;
  const tableIds = Object.keys(map);
  if (key === "foh_held_carts") await Table.updateMany({ outletId, legacyId: { $nin: tableIds }, "currentSession.kind": "active" }, { $unset: { "currentSession.lines": 1 } });
  if (key === "foh_held_meta") await Table.updateMany({ outletId, legacyId: { $nin: tableIds }, "currentSession.kind": "active" }, { $unset: { "currentSession.meta": 1 } });
  if (key === "foh_pending_bills") await Table.updateMany({ outletId, legacyId: { $nin: tableIds }, "currentSession.kind": "pending_bill" }, { $set: { currentSession: null } });
  for (const [tableId, payload] of Object.entries(map)) {
    if (key === "foh_held_carts") await Table.updateOne({ outletId, legacyId: tableId }, { $set: { "currentSession.lines": payload, "currentSession.kind": "active" } });
    if (key === "foh_held_meta") await Table.updateOne({ outletId, legacyId: tableId }, { $set: { "currentSession.meta": payload, "currentSession.kind": "active" } });
    if (key === "foh_pending_bills") await Table.updateOne({ outletId, legacyId: tableId }, { $set: { currentSession: { kind: "pending_bill", ...payload } } });
  }
}

export async function replaceResource(outletId: string, key: string, value: unknown): Promise<void> {
  if (["table_zones", "table_master", "foh_tables", "foh_held_carts", "foh_held_meta", "foh_pending_bills"].includes(key)) return projectTables(outletId, key, value);
  switch (key) {
    case "settings_profile": return void await Outlet.findByIdAndUpdate(outletId, { $set: value as Record<string, unknown> }, { runValidators: true });
    case "settings_tax": return void await Outlet.findByIdAndUpdate(outletId, { $set: { tax: value } }, { runValidators: true });
    case "settings_stations": return void await Outlet.findByIdAndUpdate(outletId, { $set: { stations: rows(value).map((x) => ({ legacyId: x.id, label: x.label, builtIn: x.builtIn })) } });
    case "invoice_seq": return void await Outlet.findByIdAndUpdate(outletId, { $max: { invoiceSequence: Number(value || 0) } });
    case "menu_categories": return replace(MenuCategory, outletId, value, (x) => ({ label: x.label, sortOrder: x.sortOrder }));
    case "menu_items": return replace(MenuItem, outletId, value, (x) => ({ name: x.name, description: x.description, categoryLegacyId: x.category, station: x.station, basePricePaise: paise(x.basePrice), isVeg: x.isVeg, imageSeed: x.imageSeed, isAvailable: x.isAvailable, taxCategory: x.taxCategory, discountEligible: x.discountEligible, dietaryTags: x.dietaryTags, variants: x.variants, addons: x.addons, dynamicPricing: x.dynamicPricing }));
    case "menu_combos": return replace(Combo, outletId, value, (x) => ({ name: x.name, description: x.description, imageSeed: x.imageSeed, comboPricePaise: paise(x.comboPrice), slots: x.slots, isAvailable: x.isAvailable, taxCategory: x.taxCategory, isVeg: x.isVeg }));
    case "inventory_items": {
      const before = await InventoryItem.find({ outletId }).select("legacyId stock unitPricePaise").lean() as any[];
      const beforeById = new Map(before.map((x) => [x.legacyId, x]));
      await replace(InventoryItem, outletId, value, (x) => ({ name: x.name, category: x.category, stock: x.stock, minLevel: x.minLevel, unit: x.unit, unitPricePaise: paise(x.unitPrice), lastRestocked: date(x.lastRestocked), supplierName: x.supplierName, supplierContact: x.supplierContact }));
      const itemDocs = await InventoryItem.find({ outletId }).select("legacyId _id stock unitPricePaise").lean() as any[];
      for (const item of itemDocs) {
        const old = beforeById.get(item.legacyId);
        const delta = Number(item.stock || 0) - Number(old?.stock || 0);
        if (delta !== 0) await InventoryMovement.create({ outletId, inventoryItemId: item._id, type: delta > 0 ? "receipt" : "consumption", quantity: delta, unitCostPaise: item.unitPricePaise, sourceType: "inventory_update", at: new Date() });
      }
      const suppliers = new Map<string, any>();
      for (const item of rows(value)) if (item.supplierName) {
        const current = suppliers.get(item.supplierName) ?? { name: item.supplierName, phone: item.supplierContact, categories: new Set<string>() };
        current.categories.add(item.category); suppliers.set(item.supplierName, current);
      }
      for (const supplier of suppliers.values()) await Supplier.findOneAndUpdate({ outletId, name: supplier.name }, { $set: { phone: supplier.phone, categories: [...supplier.categories], active: true }, $setOnInsert: { outletId, legacyId: `vendor-${supplier.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, name: supplier.name } }, { upsert: true });
      return;
    }
    case "inventory_grn": return replace(GoodsReceipt, outletId, value, (x) => ({ itemName: x.itemName, inventoryLegacyId: x.inventoryId, unit: x.unit, batchNumber: x.batchNumber, quantity: x.qtyReceived, unitCostPaise: paise(x.unitCost), supplierName: x.supplierName, receivedAt: date(x.receivedAt) }));
    case "inventory_prep_logs": return replace(PrepLog, outletId, value, (x) => ({ recipeId: x.recipeId, recipeName: x.recipeName, yieldQty: x.yieldQty, unit: x.unit, preparedBy: x.preparedBy, consumption: x.consumption, preparedAt: date(x.preparedAt) }));
    case "kds_active_kots": return replace(KOT, outletId, value, (x) => ({ orderLegacyId: x.orderId, tableLegacyId: x.tableId, waiterName: x.waiterName, firedAt: date(x.timestamp), orderSource: x.orderSource, orderType: x.orderType, guestCount: x.guestCount, customerName: x.customerName, customerPhone: x.customerPhone, items: rows(x.items).map((i) => ({ legacyId: i.id, name: i.name, quantity: i.quantity, unitPricePaise: paise(i.price), status: i.status, stationId: i.stationId, modifiers: i.modifiers, isVoided: i.isVoided, voidReason: i.voidReason })) }));
    case "foh_reservations": return replace(Reservation, outletId, value, (x) => ({ guestName: x.guestName, phone: x.phone, pax: x.pax, reservationAt: date(`${x.date}T${x.time}:00`), status: x.status, note: x.note, seatedTableLegacyId: x.seatedTableId }));
    case "foh_waitlist": return replace(WaitlistEntry, outletId, value, (x) => ({ guestName: x.guestName, phone: x.phone, pax: x.pax, quotedWait: x.quotedWait, joinedAt: date(x.joinedAt), note: x.note }));
    case "foh_tips": return replace(Tip, outletId, value, (x) => ({ staff: x.staff, tableLegacyId: x.tableId, amountPaise: paise(x.amount), paymentMethod: x.paymentMethod, at: date(x.time) }));
    case "foh_qrs": {
      await Promise.all(rows(value).map((x) => Table.updateOne({ outletId, legacyId: x.tableId }, { $set: { qrCode: x.code, qrMenuVersion: x.menuVersion, qrLastUsed: date(x.lastUsed) } })));
      return;
    }
    case "foh_completed_orders": return replace(Order, outletId, value, (x) => ({ invoiceNumber: x.invoiceNumber, tableLegacyId: x.meta?.tableId, meta: x.meta, lines: rows(x.lines).map((l) => ({ legacyId: l.lineId, name: l.item?.name ?? l.name, quantity: l.quantity, unitPricePaise: paise((l.item?.price ?? l.unitPrice ?? 0) + (l.size?.priceDelta ?? 0) + rows(l.addons).reduce((s, a) => s + Number(a.price || 0), 0)), modifiers: [l.size?.label, ...rows(l.addons).map((a) => a.label), l.specialInstructions].filter(Boolean) })), subtotalPaise: paise(x.subtotal), discountPaise: paise(x.discount), cgstPaise: paise(x.cgst), sgstPaise: paise(x.sgst), totalPaise: paise(x.total), paymentMethod: x.paymentMethod, amountTenderedPaise: paise(x.amountTendered), changeReturnedPaise: paise(x.changeReturned), status: x.status ?? "Settled", settledAt: date(x.timestamp), auditEvents: x.audit }));
    case "order_refunds": {
      for (const [displayId, refund] of Object.entries(value as Record<string, any>)) {
        const legacyId = displayId.replace(/^SRV-/, "txn-");
        await Order.updateOne({ outletId, legacyId }, { $set: { status: "Refunded", refundedAt: date(refund.at), refundReason: refund.reason } });
      }
      return;
    }
    case "crm_customers": {
      await replace(Customer, outletId, value, (x) => { const phone = String(x.phone || "").replace(/\D/g, "").slice(-10); return { name: x.name, phone: x.phone, normalizedPhone: phone.length >= 6 ? phone : undefined, email: x.email, joinedAt: date(x.joinedAt), visits: x.visits, lifetimeSpendPaise: paise(x.lifetimeSpend), points: x.points, lastVisitAt: date(x.lastVisitAt), birthday: x.birthday, tags: x.tags, preferences: x.preferences }; });
      const customers = await Customer.find({ outletId }).select("legacyId _id").lean() as any[];
      const customerIds = new Map(customers.map((x) => [x.legacyId, x._id]));
      const feedbackIds: string[] = [];
      for (const customer of rows(value)) for (const feedback of rows(customer.feedback)) {
        feedbackIds.push(feedback.id);
        await CustomerFeedback.updateOne({ outletId, legacyId: feedback.id }, { $set: { customerId: customerIds.get(customer.id), rating: feedback.rating, visitDate: date(feedback.visitDate), comment: feedback.comment, at: date(feedback.at), clientPayload: feedback }, $setOnInsert: { outletId, legacyId: feedback.id } }, { upsert: true });
      }
      await CustomerFeedback.deleteMany({ outletId, legacyId: { $nin: feedbackIds } });
      return;
    }
    case "crm_campaigns": return replace(Campaign, outletId, value, (x) => ({ name: x.name, channel: x.channel, template: x.template, audience: x.audience, reach: x.reach, status: x.status, sentAt: date(x.sentAt), scheduledAt: date(x.scheduledAt), spendPaise: paise(x.spend), revenuePaise: paise(x.revenue), redemptions: x.redemptions }));
    case "crm_message_templates": return replace(MessageTemplate, outletId, value, (x) => ({ name: x.name, subject: x.subject, body: x.body, emoji: x.emoji }));
    case "crm_coupons": return replace(Coupon, outletId, value, (x) => ({ code: x.code, kind: x.kind, value: x.value, description: x.description, minSpendPaise: paise(x.minSpend), expiresAt: date(x.expiresAt), active: x.active, issued: x.issued, redeemed: x.redeemed }));
    case "crm_loyalty_rules": return void await LoyaltyConfig.findOneAndUpdate({ outletId }, { $set: value as Record<string, unknown>, $setOnInsert: { outletId } }, { upsert: true });
    case "crew_employees": {
      await replace(Employee, outletId, value, (x) => ({ name: x.name, role: x.role, status: x.status, phone: x.phone, email: x.email, joinedAt: date(x.joinedAt), baseSalaryPaise: paise(x.baseSalary), hourlyRatePaise: paise(x.hourlyRate), rating: x.rating, hoursThisWeek: x.hoursThisWeek, tipsThisMonthPaise: paise(x.tipsThisMonth), paid: x.paid, shifts: x.shifts, punches: x.punches }));
      const employees = await Employee.find({ outletId }).select("legacyId _id").lean() as any[];
      const employeeIds = new Map(employees.map((x) => [x.legacyId, x._id]));
      await ShiftAssignment.deleteMany({ outletId });
      const assignments = rows(value).flatMap((employee) => rows(employee.shifts).map((shift) => ({ outletId, employeeId: employeeIds.get(employee.id), day: shift.day, slot: shift.slot, zone: shift.zone })));
      if (assignments.length) await ShiftAssignment.insertMany(assignments);
      return;
    }
    case "crew_permissions": {
      const source = value as Record<string, string[]>;
      await Promise.all(Object.entries(source).map(([role, permissions]) => RolePolicy.findOneAndUpdate({ outletId, role }, { $set: { permissions }, $setOnInsert: { outletId, role } }, { upsert: true })));
      return;
    }
    case "clock_events": return replace(ClockEvent, outletId, value, (x) => ({ staffId: x.staffId, staffName: x.staffName, role: x.role, type: x.type, at: date(x.at), note: x.note }));
    case "accounts_income": return upsertOnly(LedgerEntry, outletId, value, (x) => ({ type: "income", at: date(x.at), tableLabel: x.table, amountPaise: paise(x.amount), paymentMode: x.mode, server: x.server }));
    case "accounts_expenses": return upsertOnly(LedgerEntry, outletId, value, (x) => ({ type: "expense", at: date(x.at), description: x.description, category: x.category, amountPaise: paise(x.amount), paymentMode: x.mode, hasBill: x.hasBill, party: x.paidTo }));
    case "accounts_vendor_payouts": return replace(VendorPayout, outletId, value, (x) => ({ purchaseOrderLegacyId: x.poId, vendor: x.vendor, category: x.category, amountPaise: paise(x.amount), paidPaise: paise(x.paid), dueAt: date(x.dueAt), status: x.status }));
    case "boh_purchase_orders": return replace(PurchaseOrder, outletId, value, (x) => ({ supplierName: x.supplierName, status: x.status, createdAt: date(x.createdAt), expectedAt: date(x.expectedAt), receivedAt: date(x.receivedAt), notes: x.notes, vendorContact: x.vendorContact, paymentTermsDays: x.paymentTermsDays, deliveryAddress: x.deliveryAddress, externalReference: x.externalReference, lines: x.lines, totalPaise: paise(rows(x.lines).reduce((s, l) => s + Number(l.qty ?? l.quantity ?? 0) * Number(l.unitPrice ?? 0), 0)) }));
    case "boh_recipes": return replace(Recipe, outletId, rows(value).map((x) => ({ id: x.menuItemId, ...x })), (x) => ({ menuItemLegacyId: x.menuItemId, ingredients: x.ingredients, notes: x.notes }));
    case "boh_wastage": return replace(WastageEntry, outletId, value, (x) => ({ inventoryLegacyId: x.inventoryId, quantity: x.qty, reason: x.reason, recordedBy: x.recordedBy, at: date(x.at), note: x.note }));
    case "boh_prep_tasks": return replace(PrepTask, outletId, value, (x) => ({ label: x.label, quantityLabel: x.qty, station: x.station, done: x.done, assignee: x.assignee }));
    case "delivery_orders": return replace(DeliveryOrder, outletId, value, (x) => ({ source: x.source, externalRef: x.externalRef, customerName: x.customerName, customerPhone: x.customerPhone, address: x.address, lines: rows(x.items).map((i) => ({ name: i.name, quantity: i.qty, unitPricePaise: paise(i.price) })), totalPaise: paise(x.total), receivedAt: date(x.receivedAt), readyAt: date(x.readyAt), pickedAt: date(x.pickedAt), deliveredAt: date(x.deliveredAt), status: x.status, riderLegacyId: x.riderId, notes: x.notes }));
    case "delivery_riders": return replace(Rider, outletId, value, (x) => ({ name: x.name, phone: x.phone, vehicle: x.vehicle, status: x.status, todayDeliveries: x.todayDeliveries, rating: x.rating }));
    case "delivery_aggregators": return replace(AggregatorConfig, outletId, value, (x) => ({ source: x.source, sync: x.sync, snoozeUntil: date(x.snoozeUntil) }));
    case "audit_log": {
      for (const x of rows(value)) if (!await AuditEntry.exists({ outletId, legacyId: x.id })) await AuditEntry.create({ outletId, legacyId: x.id, at: date(x.at), role: x.role, actor: x.actor, action: x.action, detail: x.detail, module: x.module });
      return;
    }
  }
}
