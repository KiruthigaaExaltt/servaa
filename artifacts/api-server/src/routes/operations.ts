import { Router } from "express";
import { AuditEntry, CollectionRevision, Customer, KOT, LedgerEntry, LoyaltyConfig, mongoose, Order, Outlet, PurchaseOrder, Table, Zone } from "@workspace/db";
const router = Router();
const paise = (n: unknown) => Math.round(Number(n || 0) * 100);
const rupees = (n: number) => n / 100;

router.get("/tables", async (req, res, next) => {
  try { res.json(await Table.find({ outletId: req.outletId }).sort({ zoneLegacyId: 1, legacyId: 1 }).lean()); } catch (e) { next(e); }
});
router.get("/zones", async (req, res, next) => {
  try { res.json(await Zone.find({ outletId: req.outletId }).sort({ sortOrder: 1 }).lean()); } catch (e) { next(e); }
});
router.patch("/tables/:id", async (req, res, next): Promise<void> => {
  try {
    const allowed = ["zoneLegacyId", "capacity", "type", "isActive", "qrCode", "status", "pax", "waiterName", "customerName", "occupiedSince", "currentSession", "x", "y"];
    const patch = Object.fromEntries(Object.entries(req.body ?? {}).filter(([k]) => allowed.includes(k)));
    const table = await Table.findOneAndUpdate({ outletId: req.outletId, legacyId: req.params.id }, { $set: patch }, { new: true, runValidators: true });
    if (!table) { res.status(404).json({ error: { code: "TABLE_NOT_FOUND", message: "Table not found" } }); return; }
    res.json(table);
  } catch (e) { next(e); }
});

router.get("/purchase-orders", async (req, res, next) => {
  try { res.json(await PurchaseOrder.find({ outletId: req.outletId }).sort({ createdAt: -1 }).lean()); } catch (e) { next(e); }
});
router.post("/purchase-orders", async (req, res, next): Promise<void> => {
  try {
    if (!req.body?.id || !req.body?.supplierName || !Array.isArray(req.body?.lines)) { res.status(400).json({ error: { code: "INVALID_PO", message: "id, supplierName and lines are required" } }); return; }
    const total = req.body.lines.reduce((sum: number, line: any) => sum + Number(line.qty ?? line.quantity ?? 0) * Number(line.unitPrice ?? 0), 0);
    const po = await PurchaseOrder.findOneAndUpdate({ outletId: req.outletId, legacyId: req.body.id }, { $set: { supplierName: req.body.supplierName, status: req.body.status ?? "Draft", createdAt: req.body.createdAt ? new Date(req.body.createdAt) : new Date(), expectedAt: req.body.expectedAt ? new Date(req.body.expectedAt) : undefined, notes: req.body.notes, vendorContact: req.body.vendorContact, paymentTermsDays: req.body.paymentTermsDays, deliveryAddress: req.body.deliveryAddress, externalReference: req.body.externalReference, lines: req.body.lines, totalPaise: paise(total) }, $setOnInsert: { outletId: req.outletId, legacyId: req.body.id } }, { upsert: true, new: true, runValidators: true });
    res.status(201).json(po);
  } catch (e) { next(e); }
});

router.post("/transactions/settle", async (req, res, next): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    const body = req.body ?? {};
    if (!body.idempotencyKey || !body.tableId || !Array.isArray(body.lines) || !body.lines.length || !["Cash", "Card", "UPI"].includes(body.paymentMethod)) { res.status(400).json({ error: { code: "INVALID_SETTLEMENT", message: "A transaction key, table, non-empty lines and valid payment method are required" } }); return; }
    let result: Record<string, unknown> | undefined;
    await session.withTransaction(async () => {
      const existing = await Order.findOne({ outletId: req.outletId, legacyId: body.idempotencyKey }).session(session);
      if (existing) { result = { id: String(existing._id), invoiceNumber: existing.invoiceNumber, ledgerId: `settlement:${body.idempotencyKey}`, auditId: `settlement:${body.idempotencyKey}`, total: rupees(existing.totalPaise) }; return; }
      const outlet = await Outlet.findOneAndUpdate({ _id: req.outletId }, { $inc: { invoiceSequence: 1 } }, { new: true, session });
      if (!outlet) throw new Error("Outlet not found");
      const now = new Date();
      const invoiceNumber = body.invoiceNumber || `INV-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(outlet.invoiceSequence).padStart(4, "0")}`;
      const order = await Order.create([{ outletId: req.outletId, legacyId: body.idempotencyKey, invoiceNumber, tableLegacyId: body.tableId, meta: body.meta, lines: body.lines.map((x: any) => ({ legacyId: x.id ?? x.lineId, name: x.name ?? x.item?.name, quantity: x.quantity, unitPricePaise: paise(x.unitPrice ?? x.price ?? x.item?.price), modifiers: x.modifiers ?? [], stationId: x.stationId })), subtotalPaise: paise(body.subtotal), discountPaise: paise(body.discount), cgstPaise: paise(body.cgst), sgstPaise: paise(body.sgst), totalPaise: paise(body.total), paymentMethod: body.paymentMethod, amountTenderedPaise: paise(body.amountTendered), changeReturnedPaise: paise(body.changeReturned), status: "Settled", settledAt: now }], { session }).then((x) => x[0]);
      await Table.updateOne({ outletId: req.outletId, legacyId: body.tableId }, { $set: { status: "Cleaning", currentSession: null }, $unset: { pax: 1, customerName: 1, occupiedSince: 1 } }, { session });
      await KOT.updateMany({ outletId: req.outletId, tableLegacyId: body.tableId, closedAt: null }, { $set: { closedAt: now } }, { session });
      await LedgerEntry.create([{ outletId: req.outletId, legacyId: `settlement:${body.idempotencyKey}`, type: "income", sourceType: "order", sourceId: order._id, at: now, tableLabel: body.tableId, amountPaise: paise(body.total), paymentMode: body.paymentMethod, server: body.meta?.waiterName }], { session });
      const normalizedPhone = String(body.meta?.customerPhone || "").replace(/\D/g, "").slice(-10);
      if (normalizedPhone.length >= 6) await Customer.updateOne({ outletId: req.outletId, normalizedPhone }, { $setOnInsert: { outletId: req.outletId, normalizedPhone, phone: body.meta.customerPhone, name: body.meta.customerName || "Walk-in Guest", joinedAt: now }, $inc: { visits: 1, lifetimeSpendPaise: paise(body.total), points: Math.max(0, Number(body.pointsEarned || 0)) }, $set: { lastVisitAt: now } }, { upsert: true, session });
      await AuditEntry.create([{ outletId: req.outletId, legacyId: `settlement:${body.idempotencyKey}`, at: now, role: body.role, actor: body.meta?.waiterName || body.role, action: "settle_payment", detail: `${invoiceNumber} · Table ${body.tableId} · ₹${Number(body.total).toLocaleString("en-IN")} · ${body.paymentMethod}`, module: "foh", entityType: "Order", entityId: order._id }], { session });
      result = { id: String(order._id), invoiceNumber, ledgerId: `settlement:${body.idempotencyKey}`, auditId: `settlement:${body.idempotencyKey}`, total: Number(body.total) };
    });
    res.status(201).json(result);
  } catch (e) { next(e); } finally { await session.endSession(); }
});

router.get("/audit", async (req, res, next) => {
  try { res.json(await AuditEntry.find({ outletId: req.outletId }).sort({ at: -1 }).limit(Math.min(500, Number(req.query.limit) || 100)).lean()); } catch (e) { next(e); }
});
export default router;
