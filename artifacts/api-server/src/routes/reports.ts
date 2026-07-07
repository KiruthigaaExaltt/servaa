import { Router } from "express";
import { ClockEvent, DeliveryOrder, InventoryMovement, KOT, LedgerEntry, mongoose, Order, Table, Zone } from "@workspace/db";
const router = Router();
const rupees = (paise: number) => paise / 100;
router.get("/reports/summary", async (req, res, next): Promise<void> => {
  try {
    const outletId = new mongoose.Types.ObjectId(req.outletId);
    const from = req.query.from ? new Date(String(req.query.from)) : new Date(Date.now() - 7 * 86_400_000);
    const to = req.query.to ? new Date(String(req.query.to)) : new Date();
    if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf()) || from > to) { res.status(400).json({ error: { code: "INVALID_RANGE", message: "Invalid report date range" } }); return; }
    const match: Record<string, unknown> = { outletId, settledAt: { $gte: from, $lte: to }, status: "Settled" };
    const zoneName = String(req.query.zone || "All");
    if (zoneName !== "All") {
      const zonePattern = zoneName === "Garden" ? /^Garden/ : zoneName === "Private Dining" ? /^VIP/ : new RegExp(`^${zoneName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i");
      const zones = await Zone.find({ outletId, label: zonePattern }).select("legacyId").lean() as any[];
      const tables = await Table.find({ outletId, zoneLegacyId: { $in: zones.map((x) => x.legacyId) } }).select("legacyId").lean() as any[];
      match.tableLegacyId = { $in: tables.map((x) => x.legacyId) };
    }
    const [salesRows, paymentSplit, hourly, ledger, kds, inventory, labour, items, tables, staff, delivery, adjustments, dailyTax] = await Promise.all([
      Order.aggregate([{ $match: match }, { $group: { _id: null, revenuePaise: { $sum: "$totalPaise" }, orders: { $sum: 1 }, subtotalPaise: { $sum: "$subtotalPaise" }, discountPaise: { $sum: "$discountPaise" }, cgstPaise: { $sum: "$cgstPaise" }, sgstPaise: { $sum: "$sgstPaise" } } }]),
      Order.aggregate([{ $match: match }, { $group: { _id: "$paymentMethod", valuePaise: { $sum: "$totalPaise" }, count: { $sum: 1 } } }, { $sort: { valuePaise: -1 } }]),
      Order.aggregate([{ $match: match }, { $group: { _id: { $hour: { date: "$settledAt", timezone: process.env.REPORT_TIMEZONE || "Asia/Kolkata" } }, valuePaise: { $sum: "$totalPaise" }, orders: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      LedgerEntry.aggregate([{ $match: { outletId, at: { $gte: from, $lte: to } } }, { $group: { _id: "$type", valuePaise: { $sum: "$amountPaise" } } }]),
      KOT.aggregate([{ $match: { outletId, firedAt: { $gte: from, $lte: to } } }, { $unwind: "$items" }, { $group: { _id: "$items.stationId", items: { $sum: "$items.quantity" }, voided: { $sum: { $cond: ["$items.isVoided", 1, 0] } } } }]),
      InventoryMovement.aggregate([{ $match: { outletId, at: { $gte: from, $lte: to } } }, { $group: { _id: "$type", quantity: { $sum: "$quantity" }, valuePaise: { $sum: { $multiply: ["$quantity", "$unitCostPaise"] } } } }]),
      ClockEvent.aggregate([{ $match: { outletId, at: { $gte: from, $lte: to } } }, { $group: { _id: "$staffId", events: { $sum: 1 }, staffName: { $first: "$staffName" } } }]),
      Order.aggregate([{ $match: match }, { $unwind: "$lines" }, { $group: { _id: "$lines.name", units: { $sum: "$lines.quantity" }, revenuePaise: { $sum: { $multiply: ["$lines.quantity", "$lines.unitPricePaise"] } } } }, { $sort: { revenuePaise: -1 } }, { $limit: 25 }]),
      Order.aggregate([{ $match: match }, { $group: { _id: "$tableLegacyId", orders: { $sum: 1 }, revenuePaise: { $sum: "$totalPaise" }, firstAt: { $min: "$settledAt" }, lastAt: { $max: "$settledAt" } } }, { $sort: { revenuePaise: -1 } }]),
      Order.aggregate([{ $match: match }, { $group: { _id: "$meta.waiterName", orders: { $sum: 1 }, revenuePaise: { $sum: "$totalPaise" } } }, { $sort: { revenuePaise: -1 } }]),
      DeliveryOrder.aggregate([{ $match: { outletId, receivedAt: { $gte: from, $lte: to } } }, { $group: { _id: "$source", orders: { $sum: 1 }, revenuePaise: { $sum: "$totalPaise" }, delivered: { $sum: { $cond: [{ $eq: ["$status", "Delivered"] }, 1, 0] } } } }]),
      Order.aggregate([{ $match: { outletId, settledAt: { $gte: from, $lte: to }, status: { $in: ["Refunded", "Voided"] } } }, { $group: { _id: "$status", count: { $sum: 1 }, valuePaise: { $sum: "$totalPaise" } } }]),
      Order.aggregate([{ $match: match }, { $group: { _id: { $dateToString: { date: "$settledAt", format: "%Y-%m-%d", timezone: process.env.REPORT_TIMEZONE || "Asia/Kolkata" } }, taxablePaise: { $sum: { $subtract: ["$subtotalPaise", "$discountPaise"] } }, cgstPaise: { $sum: "$cgstPaise" }, sgstPaise: { $sum: "$sgstPaise" } } }, { $sort: { _id: 1 } }]),
    ]);
    const sales = salesRows[0] ?? { revenuePaise: 0, orders: 0, cgstPaise: 0, sgstPaise: 0 };
    res.json({ range: { from, to }, sales: { revenue: rupees(sales.revenuePaise), subtotal: rupees(sales.subtotalPaise), discount: rupees(sales.discountPaise), orders: sales.orders, averageOrderValue: sales.orders ? rupees(sales.revenuePaise / sales.orders) : 0, cgst: rupees(sales.cgstPaise), sgst: rupees(sales.sgstPaise) }, paymentSplit: paymentSplit.map((x) => ({ method: x._id, value: rupees(x.valuePaise), count: x.count })), hourly: hourly.map((x) => ({ hour: x._id, value: rupees(x.valuePaise), orders: x.orders })), ledger: ledger.map((x) => ({ type: x._id, value: rupees(x.valuePaise) })), kds, inventory: inventory.map((x) => ({ type: x._id, quantity: x.quantity, value: rupees(x.valuePaise) })), labour, items: items.map((x) => ({ name: x._id, units: x.units, revenue: rupees(x.revenuePaise) })), tables: tables.map((x) => ({ tableId: x._id, orders: x.orders, revenue: rupees(x.revenuePaise), firstAt: x.firstAt, lastAt: x.lastAt })), staff: staff.map((x) => ({ name: x._id || "Unassigned", orders: x.orders, revenue: rupees(x.revenuePaise) })), delivery: delivery.map((x) => ({ source: x._id, orders: x.orders, delivered: x.delivered, revenue: rupees(x.revenuePaise) })), adjustments: adjustments.map((x) => ({ status: x._id, count: x.count, value: rupees(x.valuePaise) })), dailyTax: dailyTax.map((x) => ({ date: x._id, taxable: rupees(x.taxablePaise), cgst: rupees(x.cgstPaise), sgst: rupees(x.sgstPaise) })) });
  } catch (error) { next(error); }
});
export default router;
