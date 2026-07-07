import { SEED_INVENTORY, type InventoryItem } from "./inventoryData";
import { SEED_MENU_ITEMS, type MenuItemAdmin } from "./menuAdmin";

/* ---------- Recipes ---------- */

export interface RecipeIngredient {
  inventoryId: string;
  qty: number; // in the inventory item's unit
}

export interface Recipe {
  menuItemId: string;
  ingredients: RecipeIngredient[];
  notes?: string;
}

const inv = (name: string): InventoryItem | undefined =>
  SEED_INVENTORY.find((i) => i.name.toLowerCase() === name.toLowerCase());

function ing(name: string, qty: number): RecipeIngredient | null {
  const i = inv(name);
  if (!i) return null;
  return { inventoryId: i.id, qty };
}

function mk(menuItemId: string, list: (RecipeIngredient | null)[]): Recipe {
  return {
    menuItemId,
    ingredients: list.filter((x): x is RecipeIngredient => x !== null),
  };
}

export const SEED_RECIPES: Recipe[] = [
  mk("m-app-1", [
    ing("Paneer", 0.2),
    ing("Yogurt", 0.05),
    ing("Onions", 0.05),
    ing("Garam Masala", 0.005),
    ing("Sunflower Oil", 0.02),
  ]),
  mk("m-app-2", [
    ing("Chicken Breast", 0.18),
    ing("Yogurt", 0.04),
    ing("Sunflower Oil", 0.03),
    ing("Garam Masala", 0.005),
  ]),
  mk("m-app-3", [
    ing("Lettuce", 0.08),
    ing("Parmesan", 0.02),
    ing("Olive Oil", 0.015),
  ]),
  mk("m-main-1", [
    ing("Chicken Breast", 0.22),
    ing("Tomatoes", 0.15),
    ing("Butter", 0.04),
    ing("Cream", 0.05),
    ing("Garam Masala", 0.006),
  ]),
  mk("m-main-2", [
    ing("Pizza Dough Balls", 1),
    ing("Tomatoes", 0.08),
    ing("Mozzarella", 0.1),
    ing("Olive Oil", 0.01),
  ]),
  mk("m-main-3", [
    ing("Basmati Rice", 0.18),
    ing("Onions", 0.08),
    ing("Tomatoes", 0.06),
    ing("Garam Masala", 0.006),
    ing("Sunflower Oil", 0.025),
  ]),
  mk("m-main-4", [
    ing("Salmon Fillet", 0.22),
    ing("Butter", 0.025),
    ing("Olive Oil", 0.01),
  ]),
  mk("m-main-5", [
    ing("Penne Pasta", 0.12),
    ing("Cream", 0.08),
    ing("Parmesan", 0.025),
    ing("Butter", 0.015),
  ]),
  mk("m-des-2", [
    ing("Dark Chocolate", 0.06),
    ing("Butter", 0.03),
    ing("Eggs", 0.05),
    ing("Sugar", 0.04),
  ]),
];

/* ---------- Recipe / Cost calculations ---------- */

export interface RecipeCost {
  menuItemId: string;
  totalCost: number;
  perIngredient: { name: string; cost: number; qty: number; unit: string }[];
}

export function calcRecipeCost(recipe: Recipe): RecipeCost {
  const lines = recipe.ingredients.map((ri) => {
    const item = SEED_INVENTORY.find((i) => i.id === ri.inventoryId);
    if (!item)
      return { name: "Unknown", cost: 0, qty: ri.qty, unit: "" };
    // unitPrice is per the item.unit (e.g. per KG). qty is in the same unit.
    const cost = item.unitPrice * ri.qty;
    return {
      name: item.name,
      cost: Math.round(cost * 100) / 100,
      qty: ri.qty,
      unit: item.unit,
    };
  });
  const total = lines.reduce((s, l) => s + l.cost, 0);
  return {
    menuItemId: recipe.menuItemId,
    totalCost: Math.round(total * 100) / 100,
    perIngredient: lines,
  };
}

export function getMenuItem(id: string): MenuItemAdmin | undefined {
  return SEED_MENU_ITEMS.find((m) => m.id === id);
}

/* ---------- Purchase Orders ---------- */

export type POStatus = "Draft" | "Sent" | "Received" | "Partially Received";

export interface POLine {
  inventoryId: string;
  qty: number;
  unitPrice: number;
  receivedQty: number;
}

export interface PurchaseOrder {
  id: string;
  supplierName: string;
  status: POStatus;
  createdAt: number;
  expectedAt?: number;
  receivedAt?: number;
  notes?: string;
  lines: POLine[];
}

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

function lineFor(name: string, qty: number): POLine | null {
  const item = inv(name);
  if (!item) return null;
  return {
    inventoryId: item.id,
    qty,
    unitPrice: item.unitPrice,
    receivedQty: 0,
  };
}

function lines(...rows: (POLine | null)[]): POLine[] {
  return rows.filter((x): x is POLine => x !== null);
}

export const SEED_POS: PurchaseOrder[] = [
  {
    id: "PO-2041",
    supplierName: "Sona Agro Mills",
    status: "Sent",
    createdAt: now - 1 * D,
    expectedAt: now + 1 * D,
    lines: lines(
      lineFor("Basmati Rice", 25),
      lineFor("Toor Dal", 20),
    ),
  },
  {
    id: "PO-2040",
    supplierName: "Daily Bread Bakery",
    status: "Partially Received",
    createdAt: now - 2 * D,
    expectedAt: now - 0.5 * D,
    lines: (() => {
      const list = lines(
        lineFor("Pizza Dough Balls", 60),
        lineFor("Burger Buns", 40),
      );
      if (list[0]) list[0].receivedQty = 60;
      return list;
    })(),
  },
  {
    id: "PO-2039",
    supplierName: "Coastal Catch Co.",
    status: "Sent",
    createdAt: now - 0.5 * D,
    expectedAt: now + 0.5 * D,
    lines: lines(lineFor("Salmon Fillet", 8), lineFor("Prawns", 5)),
    notes: "Cold chain critical",
  },
  {
    id: "PO-2038",
    supplierName: "Fresh Fields Produce",
    status: "Received",
    createdAt: now - 4 * D,
    expectedAt: now - 3 * D,
    receivedAt: now - 3 * D,
    lines: (() => {
      const list = lines(
        lineFor("Tomatoes", 20),
        lineFor("Onions", 30),
        lineFor("Lettuce", 8),
      );
      list.forEach((l) => (l.receivedQty = l.qty));
      return list;
    })(),
  },
  {
    id: "PO-2037",
    supplierName: "Dairy Best Co.",
    status: "Draft",
    createdAt: now - 0.2 * D,
    lines: lines(lineFor("Paneer", 10), lineFor("Mozzarella", 8)),
  },
];

/* ---------- Wastage ---------- */

export type WastageReason =
  | "Expired"
  | "Burnt"
  | "Dropped"
  | "Returned by Guest"
  | "Spoilage";

export const WASTAGE_REASONS: WastageReason[] = [
  "Expired",
  "Burnt",
  "Dropped",
  "Returned by Guest",
  "Spoilage",
];

export interface WastageEntry {
  id: string;
  inventoryId: string;
  qty: number;
  reason: WastageReason;
  recordedBy: string;
  at: number;
  note?: string;
}

const STAFF = ["Chef Ravi", "Sous Karan", "Pantry Anita", "Chef Suresh"];

function w(
  id: string,
  daysAgo: number,
  itemName: string,
  qty: number,
  reason: WastageReason,
  by: string,
  note?: string,
): WastageEntry | null {
  const item = inv(itemName);
  if (!item) return null;
  return {
    id,
    inventoryId: item.id,
    qty,
    reason,
    recordedBy: by,
    at: now - daysAgo * D,
    note,
  };
}

export const SEED_WASTAGE: WastageEntry[] = [
  w("ws-1", 0.2, "Tomatoes", 1.5, "Spoilage", STAFF[2], "Top crate over-ripe"),
  w("ws-2", 0.5, "Salmon Fillet", 0.4, "Burnt", STAFF[0]),
  w("ws-3", 1, "Cream", 0.5, "Expired", STAFF[2]),
  w("ws-4", 1, "Pizza Dough Balls", 4, "Dropped", STAFF[1]),
  w("ws-5", 2, "Chicken Breast", 0.3, "Returned by Guest", STAFF[3], "Guest said dry"),
  w("ws-6", 3, "Lettuce", 0.6, "Spoilage", STAFF[2]),
  w("ws-7", 4, "Mozzarella", 0.25, "Expired", STAFF[2]),
  w("ws-8", 6, "Paneer", 0.4, "Spoilage", STAFF[0]),
  w("ws-9", 8, "Tomatoes", 2, "Spoilage", STAFF[2]),
  w("ws-10", 10, "Onions", 1, "Spoilage", STAFF[2]),
  w("ws-11", 13, "Butter", 0.2, "Expired", STAFF[2]),
  w("ws-12", 16, "Prawns", 0.3, "Burnt", STAFF[0]),
  w("ws-13", 18, "Sugar", 0.5, "Dropped", STAFF[1]),
  w("ws-14", 22, "Dark Chocolate", 0.15, "Expired", STAFF[2]),
  w("ws-15", 25, "Eggs", 0.3, "Dropped", STAFF[1]),
].filter((x): x is WastageEntry => x !== null);

export function wastageValue(w: WastageEntry): number {
  const item = SEED_INVENTORY.find((i) => i.id === w.inventoryId);
  if (!item) return 0;
  return Math.round(item.unitPrice * w.qty * 100) / 100;
}

/* ---------- Prep Tasks ---------- */

export interface PrepTask {
  id: string;
  label: string;
  qty: string;
  station: "Hot" | "Cold" | "Bar" | "Bakery";
  done: boolean;
  assignee?: string;
}

export const SEED_PREP: PrepTask[] = [
  { id: "pt-1", label: "Chop Onions", qty: "10 KG", station: "Hot", done: true, assignee: "Karan" },
  { id: "pt-2", label: "Marinate Chicken", qty: "5 KG", station: "Hot", done: true, assignee: "Ravi" },
  { id: "pt-3", label: "Boil Pasta Base", qty: "3 KG", station: "Hot", done: false, assignee: "Karan" },
  { id: "pt-4", label: "Wash & Spin Lettuce", qty: "4 KG", station: "Cold", done: false, assignee: "Anita" },
  { id: "pt-5", label: "Whip Cream", qty: "2 Ltrs", station: "Cold", done: false, assignee: "Anita" },
  { id: "pt-6", label: "Squeeze Lemons", qty: "60 Pcs", station: "Bar", done: true, assignee: "Suresh" },
  { id: "pt-7", label: "Simmer Tomato Gravy", qty: "8 Ltrs", station: "Hot", done: false, assignee: "Ravi" },
  { id: "pt-8", label: "Proof Pizza Dough", qty: "40 Balls", station: "Bakery", done: false, assignee: "Karan" },
  { id: "pt-9", label: "Cube Paneer", qty: "3 KG", station: "Cold", done: false, assignee: "Anita" },
  { id: "pt-10", label: "Brew Cold Coffee Base", qty: "5 Ltrs", station: "Bar", done: true, assignee: "Suresh" },
];

/* ---------- Helpers ---------- */

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
