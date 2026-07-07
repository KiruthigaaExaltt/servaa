import {
  statusOf,
  type InventoryCategory,
  type InventoryItem,
  type InventoryUnit,
} from "./inventoryData";

/* ---------- Vendor profiles ---------- */

export interface VendorProfile {
  id: string; // stable slug — safe to use as React key
  name: string;
  contact: string;
  categories: InventoryCategory[];
  primaryCategory: InventoryCategory;
  itemCount: number;
  lowStockCount: number;
  payables: number; // active payables balance in ₹
}

// Seed of outstanding payables per supplier (₹). Suppliers not listed default to 0.
const VENDOR_PAYABLES: Record<string, number> = {
  "Sona Agro Mills": 18450,
  "Amul Distribution": 32600,
  "Fresh Catch Co.": 24100,
  "Coastal Seafoods": 41200,
  "Green Valley Farms": 8750,
  "MDH Spices": 12300,
  "Fortune Foods": 0,
  "BevCo Distributors": 15600,
  "Daily Bread Bakery": 6420,
};

// Derive the vendor directory from the live inventory so it always stays in sync
// with the items each supplier actually provides.
export function deriveVendors(items: InventoryItem[]): VendorProfile[] {
  const map = new Map<
    string,
    {
      contact: string;
      categoryCounts: Map<InventoryCategory, number>;
      itemCount: number;
      lowStockCount: number;
    }
  >();

  for (const it of items) {
    const entry = map.get(it.supplierName) ?? {
      contact: it.supplierContact,
      categoryCounts: new Map<InventoryCategory, number>(),
      itemCount: 0,
      lowStockCount: 0,
    };
    entry.contact = it.supplierContact;
    entry.categoryCounts.set(
      it.category,
      (entry.categoryCounts.get(it.category) ?? 0) + 1,
    );
    entry.itemCount += 1;
    const s = statusOf(it);
    if (s === "Low" || s === "Out") entry.lowStockCount += 1;
    map.set(it.supplierName, entry);
  }

  const vendors: VendorProfile[] = [];
  for (const [name, entry] of map) {
    const categories = [...entry.categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => c);
    vendors.push({
      id: `vendor-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      name,
      contact: entry.contact,
      categories,
      primaryCategory: categories[0],
      itemCount: entry.itemCount,
      lowStockCount: entry.lowStockCount,
      payables: VENDOR_PAYABLES[name] ?? 0,
    });
  }

  return vendors.sort((a, b) => a.name.localeCompare(b.name));
}

/* ---------- Purchase Orders ---------- */

export type POStatus = "Draft" | "Sent" | "Received" | "Cancelled";

export interface POLine {
  itemId: string;
  name: string;
  unit: InventoryUnit;
  quantity: number;
  unitPrice: number;
}

export interface PurchaseOrder {
  id: string;
  vendorName: string;
  vendorContact: string;
  createdAt: string; // ISO date
  status: POStatus;
  lines: POLine[];
}

export function poTotal(po: PurchaseOrder): number {
  return po.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
}

// Suggested reorder qty: top the item back up to twice its minimum level,
// rounded up, with a floor of 1 unit.
export function suggestReorderQty(item: InventoryItem): number {
  return Math.max(1, Math.ceil(item.minLevel * 2 - item.stock));
}

function daysAgoIso(d: number): string {
  const t = new Date();
  t.setDate(t.getDate() - d);
  return t.toISOString().slice(0, 10);
}

export const SEED_PURCHASE_ORDERS: PurchaseOrder[] = [
  {
    id: "PO-1003",
    vendorName: "Green Valley Farms",
    vendorContact: "+91 98123 45678",
    createdAt: daysAgoIso(8),
    status: "Received",
    lines: [
      { itemId: "inv-009", name: "Tomatoes", unit: "KG", quantity: 30, unitPrice: 35 },
      { itemId: "inv-010", name: "Onions", unit: "KG", quantity: 40, unitPrice: 28 },
    ],
  },
  {
    id: "PO-1004",
    vendorName: "Amul Distribution",
    vendorContact: "+91 98765 43210",
    createdAt: daysAgoIso(5),
    status: "Received",
    lines: [
      { itemId: "inv-003", name: "Full Cream Milk", unit: "Ltrs", quantity: 40, unitPrice: 62 },
      { itemId: "inv-004", name: "Paneer", unit: "KG", quantity: 10, unitPrice: 380 },
    ],
  },
  {
    id: "PO-1005",
    vendorName: "Sona Agro Mills",
    vendorContact: "+91 98200 11223",
    createdAt: daysAgoIso(1),
    status: "Sent",
    lines: [
      { itemId: "inv-001", name: "Basmati Rice", unit: "KG", quantity: 50, unitPrice: 95 },
      { itemId: "inv-016", name: "Wheat Flour (Atta)", unit: "KG", quantity: 40, unitPrice: 48 },
    ],
  },
];

function nextPoSeq(existing: PurchaseOrder[]): number {
  let max = 1005;
  for (const po of existing) {
    const n = Number(po.id.replace(/[^0-9]/g, ""));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

// Scan low/out items, cluster by vendor, and build ready-to-send draft POs.
// Items already covered by an OPEN PO (Draft or Sent) are skipped so re-running
// auto-generate never creates a duplicate order for an already-pending item.
export function generateDraftPOs(
  items: InventoryItem[],
  existing: PurchaseOrder[],
): PurchaseOrder[] {
  const pendingItemIds = new Set(
    existing
      .filter((po) => po.status === "Draft" || po.status === "Sent")
      .flatMap((po) => po.lines.map((l) => l.itemId)),
  );

  const byVendor = new Map<string, InventoryItem[]>();
  for (const it of items) {
    const s = statusOf(it);
    if (s !== "Low" && s !== "Out") continue;
    if (pendingItemIds.has(it.id)) continue;
    const list = byVendor.get(it.supplierName) ?? [];
    list.push(it);
    byVendor.set(it.supplierName, list);
  }

  const now = new Date().toISOString().slice(0, 10);
  let seq = nextPoSeq(existing);
  const drafts: PurchaseOrder[] = [];
  for (const [vendorName, list] of byVendor) {
    drafts.push({
      id: `PO-${seq++}`,
      vendorName,
      vendorContact: list[0].supplierContact,
      createdAt: now,
      status: "Draft",
      lines: list.map((it) => ({
        itemId: it.id,
        name: it.name,
        unit: it.unit,
        quantity: suggestReorderQty(it),
        unitPrice: it.unitPrice,
      })),
    });
  }

  return drafts;
}
