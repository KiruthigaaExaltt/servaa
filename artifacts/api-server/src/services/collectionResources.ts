import {
  AggregatorConfig, AuditEntry, Campaign, ClockEvent, Combo, Coupon, Customer,
  DeliveryOrder, Employee, GoodsReceipt, InventoryItem, KOT, LedgerEntry,
  LoyaltyConfig, MenuCategory, MenuItem, MessageTemplate, Order, Outlet, PrepLog,
  PrepTask, PurchaseOrder, Recipe, Reservation, Rider, RolePolicy, Supplier, Table, Tip,
  VendorPayout, WaitlistEntry, WastageEntry, Zone,
} from "@workspace/db";
import { replaceResource } from "./resourceWriter";

const DEFAULT_LOYALTY_RULES = {
  pointsPerRupee: 0.01,
  rupeePerPoint: 1,
  signupBonus: 100,
  birthdayBonus: 250,
  tiers: [
    { id: "Bronze", minSpend: 0, perks: "1× points · welcome drink", earnMultiplier: 1 },
    { id: "Silver", minSpend: 5000, perks: "1.25× points · birthday treat", earnMultiplier: 1.25 },
    { id: "Gold", minSpend: 20000, perks: "1.5× points · priority seating", earnMultiplier: 1.5 },
    { id: "Platinum", minSpend: 50000, perks: "2× points · chef's table access", earnMultiplier: 2 },
  ],
};

const models: Record<string, any> = {
  menu_categories: MenuCategory, menu_items: MenuItem, menu_combos: Combo,
  inventory_items: InventoryItem, inventory_grn: GoodsReceipt, inventory_prep_logs: PrepLog,
  kds_active_kots: KOT, foh_completed_orders: Order, foh_reservations: Reservation,
  foh_waitlist: WaitlistEntry, foh_tips: Tip, crm_customers: Customer,
  crm_campaigns: Campaign, crm_coupons: Coupon, crm_message_templates: MessageTemplate,
  crew_employees: Employee, clock_events: ClockEvent, accounts_vendor_payouts: VendorPayout,
  boh_purchase_orders: PurchaseOrder, boh_recipes: Recipe, boh_wastage: WastageEntry,
  boh_prep_tasks: PrepTask, delivery_orders: DeliveryOrder, delivery_riders: Rider,
  delivery_aggregators: AggregatorConfig, audit_log: AuditEntry,
};

export const resourceNames = new Set([
  ...Object.keys(models), "settings_profile", "settings_tax", "settings_stations", "invoice_seq",
  "table_zones", "table_master", "foh_tables", "foh_held_carts", "foh_held_meta",
  "foh_pending_bills", "foh_qrs", "crm_loyalty_rules", "crew_permissions",
  "accounts_income", "accounts_expenses", "order_refunds",
]);

export async function readResource(outletId: string, key: string): Promise<unknown> {
  if (key.startsWith("settings_") || key === "invoice_seq") {
    const outlet = await Outlet.findById(outletId).lean() as any;
    if (key === "settings_profile") return { name: outlet.name, gstin: outlet.gstin, address: outlet.address, phone: outlet.phone };
    if (key === "settings_tax") return outlet.tax;
    if (key === "settings_stations") return (outlet.stations ?? []).map((x: any) => ({ id: x.legacyId, label: x.label, builtIn: x.builtIn }));
    return outlet.invoiceSequence ?? 0;
  }
  if (key === "table_zones") return (await Zone.find({ outletId }).select("+clientPayload").sort({ sortOrder: 1 }).lean() as any[]).map((x) => x.clientPayload ?? ({ id: x.legacyId, name: x.label, color: x.color }));
  if (["table_master", "foh_tables", "foh_held_carts", "foh_held_meta", "foh_pending_bills"].includes(key)) {
    const tables = await Table.find({ outletId }).select("+adminView +fohView +currentSession").lean() as any[];
    if (key === "table_master") return tables.map((x) => x.adminView).filter(Boolean);
    if (key === "foh_tables") return tables.map((x) => x.fohView).filter(Boolean);
    const result: Record<string, unknown> = {};
    for (const x of tables) {
      if (key === "foh_held_carts" && x.currentSession?.kind === "active" && x.currentSession.lines) result[x.legacyId] = x.currentSession.lines;
      if (key === "foh_held_meta" && x.currentSession?.kind === "active" && x.currentSession.meta) result[x.legacyId] = x.currentSession.meta;
      if (key === "foh_pending_bills" && x.currentSession?.kind === "pending_bill") { const { kind, ...bill } = x.currentSession; result[x.legacyId] = bill; }
    }
    return result;
  }
  if (key === "crm_loyalty_rules") {
    return (await LoyaltyConfig.findOne({ outletId }).select("+clientPayload").lean() as any)?.clientPayload ?? DEFAULT_LOYALTY_RULES;
  }
  if (key === "crew_permissions") return Object.fromEntries((await RolePolicy.find({ outletId }).select("role permissions").lean() as any[]).map((x) => [x.role, x.permissions]));
  if (key === "accounts_income" || key === "accounts_expenses") {
    const type = key === "accounts_income" ? "income" : "expense";
    return (await LedgerEntry.find({ outletId, type }).select("+clientPayload").sort({ at: -1 }).lean() as any[]).map((x) => x.clientPayload).filter(Boolean);
  }
  if (key === "order_refunds") {
    const refunded = await Order.find({ outletId, status: "Refunded" }).select("legacyId refundReason refundedAt").lean() as any[];
    return Object.fromEntries(refunded.map((x) => [String(x.legacyId).replace(/^txn-/, "SRV-"), { reason: x.refundReason, at: x.refundedAt?.valueOf() }]));
  }
  if (key === "audit_log") return (await AuditEntry.find({ outletId }).sort({ at: -1 }).lean() as any[]).map((x) => x.clientPayload ?? ({ id: x.legacyId ?? String(x._id), at: x.at?.valueOf(), role: x.role, actor: x.actor, action: x.action, detail: x.detail, module: x.module }));
  if (key === "crm_customers") return (await Customer.find({ outletId }).select("+clientPayload").sort({ lastVisitAt: -1 }).lean() as any[]).map((x) => x.clientPayload ?? ({ id: x.legacyId ?? String(x._id), name: x.name, phone: x.phone, email: x.email, joinedAt: x.joinedAt?.toISOString?.().slice(0, 10), visits: x.visits, lifetimeSpend: Number(x.lifetimeSpendPaise || 0) / 100, points: x.points, lastVisitAt: x.lastVisitAt?.valueOf(), birthday: x.birthday, tags: x.tags ?? [], preferences: x.preferences }));
  if (key === "foh_qrs") return (await Table.find({ outletId, qrCode: { $exists: true } }).lean() as any[]).map((x) => ({ tableId: x.legacyId, code: x.qrCode, menuVersion: x.qrMenuVersion, lastUsed: x.qrLastUsed?.valueOf() }));
  const model = models[key];
  if (!model) throw new Error(`Unsupported resource: ${key}`);
  return (await model.find({ outletId }).select("+clientPayload").lean() as any[]).map((x) => x.clientPayload).filter((x) => x !== undefined);
}

export async function writeResource(outletId: string, key: string, value: unknown): Promise<void> {
  if (!resourceNames.has(key)) throw new Error(`Unsupported resource: ${key}`);
  await replaceResource(outletId, key, value);
  if (key === "crm_loyalty_rules") await LoyaltyConfig.updateOne({ outletId }, { $set: { clientPayload: value } });
  await resolveReferences(outletId, key);
}

async function resolveReferences(outletId: string, key: string): Promise<void> {
  if (key === "menu_items") {
    const categories = await MenuCategory.find({ outletId }).select("legacyId _id").lean() as any[];
    for (const category of categories) await MenuItem.updateMany({ outletId, categoryLegacyId: category.legacyId }, { $set: { categoryId: category._id } });
  }
  if (["inventory_grn", "boh_wastage"].includes(key)) {
    const items = await InventoryItem.find({ outletId }).select("legacyId _id").lean() as any[];
    for (const item of items) {
      if (key === "inventory_grn") await GoodsReceipt.updateMany({ outletId, inventoryLegacyId: item.legacyId }, { $set: { inventoryItemId: item._id } });
      else await WastageEntry.updateMany({ outletId, inventoryLegacyId: item.legacyId }, { $set: { inventoryItemId: item._id } });
    }
  }
  if (key === "boh_recipes") {
    const items = await MenuItem.find({ outletId }).select("legacyId _id").lean() as any[];
    for (const item of items) await Recipe.updateMany({ outletId, menuItemLegacyId: item.legacyId }, { $set: { menuItemId: item._id } });
  }
  if (key === "boh_purchase_orders") {
    const suppliers = await Supplier.find({ outletId }).select("name _id").lean() as any[];
    for (const supplier of suppliers) await PurchaseOrder.updateMany({ outletId, supplierName: supplier.name }, { $set: { supplierId: supplier._id } });
  }
  if (key === "clock_events") {
    const employees = await Employee.find({ outletId }).select("legacyId _id").lean() as any[];
    for (const employee of employees) await ClockEvent.updateMany({ outletId, staffId: employee.legacyId }, { $set: { employeeId: employee._id } });
  }
  if (key === "delivery_orders") {
    const riders = await Rider.find({ outletId }).select("legacyId _id").lean() as any[];
    for (const rider of riders) await DeliveryOrder.updateMany({ outletId, riderLegacyId: rider.legacyId }, { $set: { riderId: rider._id } });
  }
}
