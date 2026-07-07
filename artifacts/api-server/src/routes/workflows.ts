import { Router } from "express";
import {
  AuditEntry, ClockEvent, CollectionRevision, Customer, CustomerFeedback, DeliveryOrder,
  GoodsReceipt, InventoryItem, InventoryMovement, LedgerEntry, mongoose, Order, PrepLog,
  PurchaseOrder, Rider, Table, WastageEntry,
} from "@workspace/db";

const router = Router();
const paise = (value: unknown) => Math.round(Number(value || 0) * 100);
const bump = (outletId: string, resources: string[]) => CollectionRevision.bulkWrite(resources.map((resource) => ({ updateOne: { filter: { outletId, resource }, update: { $inc: { revision: 1 }, $setOnInsert: { outletId, resource } }, upsert: true } })));

router.post("/inventory/grn", async (req, res, next): Promise<void> => {
  try {
    const { id, inventoryId, batchNumber, qtyReceived, unitCost, itemName, unit, supplierName, resultingStock } = req.body ?? {};
    if (!id || !inventoryId || !batchNumber || !(Number(qtyReceived) > 0) || !(Number(unitCost) >= 0)) { res.status(400).json({ error: { code: "INVALID_GRN", message: "Valid id, inventoryId, batchNumber, quantity and cost are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      const item = await InventoryItem.findOneAndUpdate({ outletId: req.outletId, legacyId: inventoryId }, { $set: { stock: Number(resultingStock), "clientPayload.stock": Number(resultingStock), unitPricePaise: paise(unitCost), lastRestocked: new Date(), "clientPayload.unitPrice": Number(unitCost), "clientPayload.lastRestocked": new Date().toISOString().slice(0, 10) } }, { new: true });
      if (!item) throw new Error("INVENTORY_ITEM_NOT_FOUND");
      const receipt = await GoodsReceipt.findOneAndUpdate({ outletId: req.outletId, legacyId: id }, { $set: { inventoryItemId: item._id, inventoryLegacyId: inventoryId, itemName, unit, batchNumber, quantity: Number(qtyReceived), unitCostPaise: paise(unitCost), supplierName, receivedAt: new Date(), clientPayload: req.body }, $setOnInsert: { outletId: req.outletId, legacyId: id } }, { upsert: true, new: true });
      await InventoryMovement.updateOne({ outletId: req.outletId, sourceType: "goods_receipt", sourceId: receipt._id, inventoryItemId: item._id }, { $setOnInsert: { outletId: req.outletId, inventoryItemId: item._id, type: "receipt", quantity: Number(qtyReceived), unitCostPaise: paise(unitCost), sourceType: "goods_receipt", sourceId: receipt._id, userId: req.userId, at: new Date() } }, { upsert: true });
      const amount = Number(qtyReceived) * Number(unitCost);
      await LedgerEntry.create({ outletId: req.outletId, legacyId: `grn:${id}`, type: "expense", sourceType: "goods_receipt", sourceId: receipt._id, at: new Date(), description: `GRN ${batchNumber} · ${itemName}`, category: "Groceries", amountPaise: paise(amount), paymentMode: "UPI", hasBill: true, party: supplierName, clientPayload: { id: `grn:${id}`, at: Date.now(), description: `GRN ${batchNumber} · ${itemName}`, category: "Groceries", amount, mode: "UPI", hasBill: true, paidTo: supplierName } });
      await bump(String(req.outletId), ["inventory_items", "inventory_grn", "accounts_expenses"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { if (error instanceof Error && error.message === "INVENTORY_ITEM_NOT_FOUND") { res.status(404).json({ error: { code: error.message, message: "Inventory item not found" } }); return; } next(error); }
});

router.post("/inventory/prep", async (req, res, next): Promise<void> => {
  try {
    const { id, recipeId, recipeName, yieldQty, yieldUnit, preparedBy, consumed } = req.body ?? {};
    if (!id || !recipeId || !(Number(yieldQty) > 0) || !Array.isArray(consumed)) { res.status(400).json({ error: { code: "INVALID_PREP", message: "Valid prep batch and consumption are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      const prepLog = await PrepLog.findOneAndUpdate({ outletId: req.outletId, legacyId: id }, { $set: { recipeId, recipeName, yieldQty, unit: yieldUnit, preparedBy, consumption: consumed, preparedAt: new Date(), clientPayload: req.body }, $setOnInsert: { outletId: req.outletId, legacyId: id } }, { upsert: true, new: true });
      for (const draw of consumed) {
        const item = await InventoryItem.findOne({ outletId: req.outletId, legacyId: draw.inventoryId });
        if (!item) throw new Error(`Missing inventory item ${draw.inventoryId}`);
        const quantity = Math.max(0, Number(draw.qty || 0));
        item.stock = Math.max(0, Number(draw.resultingStock));
        if (item.clientPayload) item.clientPayload.stock = item.stock;
        await item.save();
        await InventoryMovement.updateOne({ outletId: req.outletId, sourceType: "prep_log", sourceId: prepLog._id, inventoryItemId: item._id }, { $setOnInsert: { outletId: req.outletId, inventoryItemId: item._id, type: "prep_consumption", quantity: -quantity, unitCostPaise: item.unitPricePaise, sourceType: "prep_log", sourceId: prepLog._id, userId: req.userId, at: new Date() } }, { upsert: true });
      }
      await bump(String(req.outletId), ["inventory_items", "inventory_prep_logs"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { next(error); }
});

router.post("/inventory/wastage", async (req, res, next): Promise<void> => {
  try {
    const { id, inventoryId, qty, reason, recordedBy, at, note } = req.body ?? {};
    if (!id || !inventoryId || !(Number(qty) > 0) || !String(reason || "").trim()) { res.status(400).json({ error: { code: "INVALID_WASTAGE", message: "Item, positive quantity and reason are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      if (await WastageEntry.exists({ outletId: req.outletId, legacyId: id })) return;
      const item = await InventoryItem.findOne({ outletId: req.outletId, legacyId: inventoryId }).select("+clientPayload");
      if (!item) throw new Error("INVENTORY_ITEM_NOT_FOUND");
      const quantity = Number(qty);
      if (item.stock < quantity) throw new Error("INSUFFICIENT_STOCK");
      item.stock -= quantity;
      if (item.clientPayload) item.clientPayload.stock = item.stock;
      await item.save();
      const wastage = await WastageEntry.create({ outletId: req.outletId, legacyId: id, inventoryItemId: item._id, inventoryLegacyId: inventoryId, quantity, reason: String(reason).trim(), userId: req.userId, recordedBy, at: new Date(at || Date.now()), note, clientPayload: req.body });
      await InventoryMovement.create({ outletId: req.outletId, inventoryItemId: item._id, type: "wastage", quantity: -quantity, unitCostPaise: item.unitPricePaise, sourceType: "wastage", sourceId: wastage._id, userId: req.userId, at: new Date(at || Date.now()) });
      const amountPaise = Math.round(quantity * item.unitPricePaise);
      await LedgerEntry.create({ outletId: req.outletId, legacyId: `wastage:${id}`, type: "expense", sourceType: "wastage", sourceId: wastage._id, at: new Date(at || Date.now()), description: `Wastage · ${item.name} (${reason})`, category: "Groceries", amountPaise, paymentMode: "Adjustment", hasBill: false, clientPayload: { id: `wastage:${id}`, at: Number(at || Date.now()), description: `Wastage · ${item.name} (${reason})`, category: "Groceries", amount: amountPaise / 100, mode: "Adjustment", hasBill: false } });
      await AuditEntry.create({ outletId: req.outletId, legacyId: `wastage:${id}`, at: new Date(), userId: req.userId, role: req.userRole, actor: recordedBy || req.userRole, action: "record_wastage", detail: `${item.name} · ${quantity} ${item.unit} · ${reason}`, module: "boh", entityType: "WastageEntry", entityId: wastage._id });
      await bump(String(req.outletId), ["inventory_items", "boh_wastage", "accounts_expenses", "audit_log"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) {
    if (error instanceof Error && ["INVENTORY_ITEM_NOT_FOUND", "INSUFFICIENT_STOCK"].includes(error.message)) { res.status(error.message === "INVENTORY_ITEM_NOT_FOUND" ? 404 : 409).json({ error: { code: error.message, message: error.message === "INSUFFICIENT_STOCK" ? "Wastage exceeds available stock" : "Inventory item not found" } }); return; }
    next(error);
  }
});

router.post("/purchase-orders/:id/receive", async (req, res, next): Promise<void> => {
  try {
    const delivered = req.body?.deliveredQtys as Record<string, number> | undefined;
    const receiptId = String(req.body?.receiptId || "");
    if (!receiptId || !delivered || typeof delivered !== "object") { res.status(400).json({ error: { code: "INVALID_PO_RECEIPT", message: "receiptId and delivered quantities are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      if (await LedgerEntry.exists({ outletId: req.outletId, legacyId: `po-receipt:${receiptId}` })) return;
      const po = await PurchaseOrder.findOne({ outletId: req.outletId, legacyId: req.params.id }).select("+clientPayload");
      if (!po) throw new Error("PO_NOT_FOUND");
      const payload = po.clientPayload as any;
      let total = 0;
      for (const line of payload.lines ?? []) {
        const qty = Math.max(0, Math.min(Number(delivered[line.inventoryId] || 0), Number(line.qty || 0) - Number(line.receivedQty || 0)));
        if (!qty) continue;
        const item = await InventoryItem.findOneAndUpdate({ outletId: req.outletId, legacyId: line.inventoryId }, { $inc: { stock: qty, "clientPayload.stock": qty }, $set: { unitPricePaise: paise(line.unitPrice), lastRestocked: new Date(), "clientPayload.unitPrice": Number(line.unitPrice), "clientPayload.lastRestocked": new Date().toISOString().slice(0, 10) } }, { new: true });
        if (!item) throw new Error(`Missing inventory item ${line.inventoryId}`);
        const receipt = await GoodsReceipt.create({ outletId: req.outletId, legacyId: `${receiptId}:${line.inventoryId}`, inventoryItemId: item._id, inventoryLegacyId: line.inventoryId, purchaseOrderId: po._id, itemName: item.name, unit: item.unit, batchNumber: po.legacyId, quantity: qty, unitCostPaise: paise(line.unitPrice), supplierName: po.supplierName, receivedAt: new Date(), clientPayload: { id: `${receiptId}:${line.inventoryId}`, inventoryId: line.inventoryId, itemName: item.name, unit: item.unit, batchNumber: po.legacyId, qtyReceived: qty, unitCost: line.unitPrice, supplierName: po.supplierName, receivedAt: Date.now() } });
        await InventoryMovement.create({ outletId: req.outletId, inventoryItemId: item._id, type: "po_receipt", quantity: qty, unitCostPaise: paise(line.unitPrice), sourceType: "goods_receipt", sourceId: receipt._id, userId: req.userId, at: new Date() });
        line.receivedQty = Number(line.receivedQty || 0) + qty;
        total += qty * Number(line.unitPrice || 0);
      }
      const allFull = (payload.lines ?? []).every((line: any) => Number(line.receivedQty || 0) >= Number(line.qty || 0));
      const anyReceived = (payload.lines ?? []).some((line: any) => Number(line.receivedQty || 0) > 0);
      payload.status = allFull ? "Received" : anyReceived ? "Partially Received" : payload.status;
      if (allFull) payload.receivedAt = Date.now();
      po.status = payload.status; po.receivedAt = allFull ? new Date() : po.receivedAt; po.lines = payload.lines; po.clientPayload = payload; await po.save();
      await LedgerEntry.create({ outletId: req.outletId, legacyId: `po-receipt:${receiptId}`, type: "expense", sourceType: "purchase_order_receipt", sourceId: po._id, at: new Date(), description: `PO ${po.legacyId} receipt`, category: "Groceries", amountPaise: paise(total), paymentMode: "UPI", hasBill: true, party: po.supplierName, clientPayload: { id: `po-receipt:${receiptId}`, at: Date.now(), description: `PO ${po.legacyId} receipt`, category: "Groceries", amount: total, mode: "UPI", hasBill: true, paidTo: po.supplierName } });
      await bump(String(req.outletId), ["boh_purchase_orders", "inventory_items", "inventory_grn", "accounts_expenses"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { if (error instanceof Error && error.message === "PO_NOT_FOUND") { res.status(404).json({ error: { code: error.message, message: "Purchase order not found" } }); return; } next(error); }
});

router.post("/orders/:id/refund", async (req, res, next): Promise<void> => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) { res.status(400).json({ error: { code: "REFUND_REASON_REQUIRED", message: "A refund reason is required" } }); return; }
    await mongoose.connection.transaction(async () => {
      const legacyId = req.params.id.replace(/^SRV-/, "txn-");
      const order = await Order.findOne({ outletId: req.outletId, legacyId });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      order.status = "Refunded"; order.refundedAt ??= new Date(); order.refundReason = reason; await order.save();
      const ledgerId = `refund:${legacyId}`;
      await LedgerEntry.updateOne({ outletId: req.outletId, legacyId: ledgerId }, { $setOnInsert: { outletId: req.outletId, legacyId: ledgerId, type: "expense", sourceType: "refund", sourceId: order._id, at: new Date(), description: `Refund reversal — ${req.params.id}: ${reason}`, category: "Misc", amountPaise: order.totalPaise, paymentMode: "Adjustment", hasBill: false, party: "Customer Refund", clientPayload: { id: ledgerId, at: Date.now(), description: `Refund reversal — ${req.params.id}: ${reason}`, category: "Misc", amount: order.totalPaise / 100, mode: "Adjustment", hasBill: false, paidTo: "Customer Refund" } } }, { upsert: true });
      if (!await AuditEntry.exists({ outletId: req.outletId, legacyId: ledgerId })) await AuditEntry.create({ outletId: req.outletId, legacyId: ledgerId, at: new Date(), userId: req.userId, role: req.userRole, actor: req.userRole, action: "refund_order", detail: `${req.params.id} · ${reason}`, module: "orders", entityType: "Order", entityId: order._id });
      await bump(String(req.outletId), ["foh_completed_orders", "order_refunds", "accounts_expenses", "audit_log"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { if (error instanceof Error && error.message === "ORDER_NOT_FOUND") { res.status(404).json({ error: { code: error.message, message: "Order not found" } }); return; } next(error); }
});

router.post("/clock", async (req, res, next): Promise<void> => {
  try {
    const { id, staffId, staffName, role, type, at, note } = req.body ?? {};
    if (!id || !staffId || !["clock_in", "clock_out"].includes(type)) { res.status(400).json({ error: { code: "INVALID_CLOCK_EVENT", message: "Valid event id, staff and type are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      if (await ClockEvent.exists({ outletId: req.outletId, legacyId: id })) return;
      const last = await ClockEvent.findOne({ outletId: req.outletId, staffId }).sort({ at: -1 });
      if (type === "clock_in" && last?.type === "clock_in") throw new Error("ALREADY_CLOCKED_IN");
      if (type === "clock_out" && last?.type !== "clock_in") throw new Error("NOT_CLOCKED_IN");
      await ClockEvent.create({ outletId: req.outletId, legacyId: id, staffId, staffName, role, type, at: new Date(at || Date.now()), note, clientPayload: req.body });
      await bump(String(req.outletId), ["clock_events"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { if (error instanceof Error && ["ALREADY_CLOCKED_IN", "NOT_CLOCKED_IN"].includes(error.message)) { res.status(409).json({ error: { code: error.message, message: error.message === "ALREADY_CLOCKED_IN" ? "Staff member is already clocked in" : "Staff member is not clocked in" } }); return; } next(error); }
});

router.post("/customers/:phone/feedback", async (req, res, next): Promise<void> => {
  try {
    const phone = req.params.phone.replace(/\D/g, "").slice(-10);
    const { id, rating, visitDate, comment, at } = req.body ?? {};
    if (!id || !(Number(rating) >= 1 && Number(rating) <= 5)) { res.status(400).json({ error: { code: "INVALID_FEEDBACK", message: "Feedback id and rating from 1 to 5 are required" } }); return; }
    await mongoose.connection.transaction(async () => {
      const customer = await Customer.findOne({ outletId: req.outletId, normalizedPhone: phone });
      if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      await CustomerFeedback.updateOne({ outletId: req.outletId, legacyId: id }, { $setOnInsert: { outletId: req.outletId, legacyId: id, customerId: customer._id, rating, visitDate: new Date(visitDate), comment, at: new Date(at || Date.now()), clientPayload: req.body } }, { upsert: true });
      await bump(String(req.outletId), ["crm_customers"]);
    });
    res.status(201).json({ ok: true });
  } catch (error) { if (error instanceof Error && error.message === "CUSTOMER_NOT_FOUND") { res.status(404).json({ error: { code: error.message, message: "Customer not found" } }); return; } next(error); }
});

export default router;
