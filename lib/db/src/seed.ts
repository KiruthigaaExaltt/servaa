import { randomBytes, scryptSync } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { connectDatabase, disconnectDatabase, mongoose } from "./index";
import { CollectionRevision, Outlet, RolePolicy, Table, User, Zone } from "./schema";

const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 32).toString("hex")}`;
};

const slug = process.env.DEFAULT_OUTLET_SLUG || "servaa-main";
await connectDatabase();
try {
  const outlet = await Outlet.findOneAndUpdate(
    { slug },
    { $setOnInsert: { slug, name: "Servaa Restaurant", gstin: "29ABCDE1234F1Z5", address: "123 Main Street, Bangalore – 560001", phone: "+91 98765 43210", tax: { cgstPct: 2.5, sgstPct: 2.5 }, stations: [{ legacyId: "Hot", label: "Tandoor / Hot Station", builtIn: true }, { legacyId: "Cold", label: "Cold Station", builtIn: true }, { legacyId: "Bar", label: "Bar", builtIn: true }] } },
    { upsert: true, new: true },
  );
  // Reconcile index definitions before bulk seed writes. This also replaces
  // older compound sparse indexes that incorrectly treated null as unique.
  await mongoose.connection.syncIndexes();
  const zones = [
    ["z-main", "Main Hall", "blue"], ["z-garden", "Garden Area", "emerald"],
    ["z-vip", "VIP Section", "purple"], ["z-rooftop", "Rooftop", "orange"],
  ] as const;
  for (const [legacyId, label, color] of zones) await Zone.updateOne({ outletId: outlet._id, legacyId }, { $set: { label, color }, $setOnInsert: { outletId: outlet._id, legacyId } }, { upsert: true });
  const mainZone = await Zone.findOne({ outletId: outlet._id, legacyId: "z-main" });
  for (let n = 1; n <= 12; n++) {
    const legacyId = `T-${n}`;
    await Table.updateOne({ outletId: outlet._id, legacyId }, { $setOnInsert: { outletId: outlet._id, legacyId, zoneId: mainZone?._id, zoneLegacyId: "z-main", capacity: n % 4 === 0 ? 6 : 4, type: "Standard", isActive: true, qrCode: `QR${String(n).padStart(3, "0")}`, status: "Vacant" } }, { upsert: true });
  }
  const roles = ["Admin", "Manager", "Cashier", "Server", "Kitchen"] as const;
  const allModules = ["dashboard", "tables", "foh", "menu", "kot-kds", "inventory", "boh", "delivery", "orders-billing", "crew", "accounts", "crm-loyalty", "reports", "settings"];
  const allPermissions = ["send_kot", "generate_bill", "settle_payment", "pull_back_bill", "delete_row", "view_reports", "manage_accounts", "manage_inventory", "manage_menu", "manage_crew", "manage_settings", "manage_crm", "admin_override"];
  for (const role of roles) {
    const legacyId = role.toLowerCase();
    const email = `${legacyId}@seed.servaa.local`;
    const existing = await User.findOne({ outletId: outlet._id, legacyId });
    if (!existing) await User.create({ outletId: outlet._id, legacyId, name: `${role} User`, email, role, pinHash: hashPin(process.env.SEED_ADMIN_PIN || "1234"), active: true });
    else if (!existing.email) { existing.email = email; await existing.save(); }
    const modules = role === "Cashier" ? ["dashboard", "foh", "orders-billing", "accounts"] : role === "Server" ? ["foh", "tables", "dashboard"] : role === "Kitchen" ? ["kot-kds"] : allModules;
    const permissions = role === "Cashier" ? ["send_kot", "generate_bill", "settle_payment"] : role === "Server" ? ["send_kot", "generate_bill"] : role === "Kitchen" ? [] : allPermissions;
    await RolePolicy.updateOne({ outletId: outlet._id, role }, { $set: { permissions, modules }, $setOnInsert: { outletId: outlet._id, role } }, { upsert: true });
  }
  const workspace = path.resolve(import.meta.dirname, "..", "..", "..");
  const load = (relative: string) => import(pathToFileURL(path.join(workspace, relative)).href) as Promise<Record<string, any>>;
  const [menu, inventory, grn, foh, crm, accounts, crew, delivery, boh, tableAdmin, kots] = await Promise.all([
    load("artifacts/servaa/src/lib/menuAdmin.ts"), load("artifacts/servaa/src/lib/inventoryData.ts"),
    load("artifacts/servaa/src/lib/grn.ts"), load("artifacts/servaa/src/lib/fohData.ts"),
    load("artifacts/servaa/src/lib/crmData.ts"), load("artifacts/servaa/src/lib/accountsData.ts"),
    load("artifacts/servaa/src/lib/crewData.ts"), load("artifacts/servaa/src/lib/deliveryData.ts"),
    load("artifacts/servaa/src/lib/bohData.ts"), load("artifacts/servaa/src/lib/tablesAdminData.ts"),
    load("artifacts/servaa/src/lib/seedKOTs.ts"),
  ]);
  const writerUrl = pathToFileURL(path.join(workspace, "artifacts/api-server/src/services/resourceWriter.ts")).href;
  const { replaceResource } = await import(writerUrl) as { replaceResource: (outletId: string, key: string, value: unknown) => Promise<void> };
  const resources: Record<string, unknown> = {
    settings_profile: { name: outlet.name, gstin: outlet.gstin, address: outlet.address, phone: outlet.phone },
    settings_tax: outlet.tax, settings_stations: outlet.stations.map((station: any) => ({ id: station.legacyId, label: station.label, builtIn: station.builtIn })), invoice_seq: outlet.invoiceSequence,
    table_zones: tableAdmin.SEED_ZONES, table_master: tableAdmin.SEED_TABLE_MASTERS,
    foh_tables: foh.SEED_TABLES, foh_reservations: foh.SEED_RESERVATIONS,
    foh_waitlist: foh.SEED_WAITLIST, foh_tips: foh.SEED_TIPS, foh_qrs: foh.SEED_QRS,
    foh_held_carts: {}, foh_held_meta: {}, foh_pending_bills: {}, foh_completed_orders: [],
    menu_categories: menu.SEED_MENU_CATEGORIES, menu_items: menu.SEED_MENU_ITEMS, menu_combos: menu.SEED_COMBOS,
    inventory_items: inventory.SEED_INVENTORY, inventory_grn: grn.SEED_GRN,
    inventory_prep_logs: grn.SEED_PREP_LOGS, kds_active_kots: kots.SEED_KOTS,
    crm_customers: crm.SEED_CUSTOMERS, crm_campaigns: crm.SEED_CAMPAIGNS,
    crm_coupons: crm.SEED_COUPONS, crm_loyalty_rules: crm.SEED_RULES,
    crm_message_templates: crm.SEED_TEMPLATES, accounts_income: accounts.SEED_INCOME,
    accounts_expenses: accounts.SEED_EXPENSES, accounts_vendor_payouts: accounts.SEED_VENDORS,
    crew_employees: crew.SEED_CREW, crew_permissions: crew.SEED_PERMISSIONS,
    delivery_orders: delivery.SEED_DELIVERIES, delivery_riders: delivery.SEED_RIDERS,
    delivery_aggregators: delivery.SEED_AGGREGATORS, boh_recipes: boh.SEED_RECIPES,
    boh_purchase_orders: boh.SEED_POS, boh_wastage: boh.SEED_WASTAGE, boh_prep_tasks: boh.SEED_PREP,
    audit_log: [], clock_events: [], order_refunds: {},
  };
  for (const [resource, value] of Object.entries(resources)) {
    const revision = await CollectionRevision.findOne({ outletId: outlet._id, resource });
    if (!revision) {
      await replaceResource(String(outlet._id), resource, value);
      await CollectionRevision.create({ outletId: outlet._id, resource, revision: 1 });
    }
  }
  for (const model of Object.values(mongoose.models)) await model.syncIndexes();
  console.log(`Seeded outlet ${slug}`);
} finally {
  await disconnectDatabase();
}
