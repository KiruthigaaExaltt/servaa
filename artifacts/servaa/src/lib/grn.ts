import {
  SEED_INVENTORY,
  type InventoryItem,
  type InventoryUnit,
} from "./inventoryData";

/* ---------- Goods Received Notes (GRN) ---------- */

// A GRN records a single received batch of a raw inventory item. Logging one
// increases that item's live stock and stamps a batch/lot identifier so the
// received consignment stays traceable.
export interface GRNBatch {
  id: string;
  inventoryId: string;
  itemName: string;
  unit: InventoryUnit;
  batchNumber: string;
  qtyReceived: number;
  unitCost: number;
  supplierName: string;
  receivedAt: number;
}

export function grnValue(g: GRNBatch): number {
  return Math.round(g.qtyReceived * g.unitCost * 100) / 100;
}

/* ---------- Daily Recipe Prep formulas ---------- */

// A prep recipe is a bulk "base preparation" a kitchen produces during the day
// (gravies, doughs, marinades). Each ingredient qty is expressed PER 1 unit of
// finished yield, so a 10 KG batch multiplies every ingredient qty by 10.
export interface PrepIngredient {
  inventoryId: string;
  qtyPerYieldUnit: number; // consumed per 1 yieldUnit of output
}

export interface PrepRecipe {
  id: string;
  name: string;
  yieldUnit: InventoryUnit; // unit the batch is prepared in (KG / Ltrs)
  ingredients: PrepIngredient[];
}

const inv = (name: string): InventoryItem | undefined =>
  SEED_INVENTORY.find((i) => i.name.toLowerCase() === name.toLowerCase());

function ing(name: string, qtyPerYieldUnit: number): PrepIngredient | null {
  const item = inv(name);
  if (!item) return null;
  return { inventoryId: item.id, qtyPerYieldUnit };
}

function mk(
  id: string,
  name: string,
  yieldUnit: InventoryUnit,
  list: (PrepIngredient | null)[],
): PrepRecipe {
  return {
    id,
    name,
    yieldUnit,
    ingredients: list.filter((x): x is PrepIngredient => x !== null),
  };
}

// Formulas map onto items that exist in SEED_INVENTORY so every deduction hits
// a live stock count. Quantities are per 1 KG / 1 Ltr of finished base.
export const PREP_RECIPES: PrepRecipe[] = [
  mk("prep-makhani", "Makhani Gravy Base", "KG", [
    ing("Tomatoes", 0.5),
    ing("Butter (Salted)", 0.2),
    ing("Onions", 0.1),
    ing("Garam Masala", 0.01),
    ing("Refined Sunflower Oil", 0.03),
  ]),
  mk("prep-dal", "Yellow Dal Tadka", "KG", [
    ing("Toor Dal", 0.4),
    ing("Onions", 0.1),
    ing("Tomatoes", 0.1),
    ing("Turmeric Powder", 0.005),
    ing("Ghee", 0.03),
  ]),
  mk("prep-chicken", "Marinated Chicken", "KG", [
    ing("Chicken (Boneless)", 0.85),
    ing("Garam Masala", 0.01),
    ing("Turmeric Powder", 0.004),
    ing("Refined Sunflower Oil", 0.03),
  ]),
  mk("prep-biryani", "Biryani Rice Base", "KG", [
    ing("Basmati Rice", 0.6),
    ing("Onions", 0.1),
    ing("Ghee", 0.05),
    ing("Garam Masala", 0.008),
  ]),
  mk("prep-naan", "Naan Dough", "KG", [
    ing("Wheat Flour (Atta)", 0.7),
    ing("Full Cream Milk", 0.15),
    ing("Butter (Salted)", 0.05),
  ]),
  mk("prep-onion-paste", "Brown Onion Paste", "KG", [
    ing("Onions", 0.9),
    ing("Refined Sunflower Oil", 0.1),
  ]),
];

// A logged production run and the exact raw drawdown it caused.
export interface PrepConsumption {
  inventoryId: string;
  name: string;
  qty: number;
  unit: InventoryUnit;
}

export interface PrepBatchLog {
  id: string;
  recipeId: string;
  recipeName: string;
  yieldQty: number;
  yieldUnit: InventoryUnit;
  preparedBy: string;
  at: number;
  consumed: PrepConsumption[];
}

export const PREP_STAFF = [
  "Chef Ravi",
  "Sous Karan",
  "Pantry Anita",
  "Chef Suresh",
];

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

function seedGRN(
  id: string,
  itemName: string,
  batchNumber: string,
  qtyReceived: number,
  daysAgo: number,
): GRNBatch | null {
  const item = inv(itemName);
  if (!item) return null;
  return {
    id,
    inventoryId: item.id,
    itemName: item.name,
    unit: item.unit,
    batchNumber,
    qtyReceived,
    unitCost: item.unitPrice,
    supplierName: item.supplierName,
    receivedAt: now - daysAgo * D,
  };
}

export const SEED_GRN: GRNBatch[] = [
  seedGRN("grn-1", "Basmati Rice", "BR-2406", 25, 3),
  seedGRN("grn-2", "Paneer", "PN-0118", 10, 2),
  seedGRN("grn-3", "Tomatoes", "TM-0909", 30, 2),
  seedGRN("grn-4", "Full Cream Milk", "MK-0451", 40, 1),
].filter((x): x is GRNBatch => x !== null);

function seedPrepLog(
  id: string,
  recipeId: string,
  yieldQty: number,
  preparedBy: string,
  daysAgo: number,
): PrepBatchLog | null {
  const recipe = PREP_RECIPES.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const { consumed } = computePrepDraw(recipe, yieldQty, SEED_INVENTORY);
  return {
    id,
    recipeId: recipe.id,
    recipeName: recipe.name,
    yieldQty,
    yieldUnit: recipe.yieldUnit,
    preparedBy,
    at: now - daysAgo * D,
    consumed,
  };
}

export const SEED_PREP_LOGS: PrepBatchLog[] = [
  seedPrepLog("pl-1", "prep-makhani", 10, "Chef Ravi", 1),
  seedPrepLog("pl-2", "prep-naan", 8, "Sous Karan", 0),
].filter((x): x is PrepBatchLog => x !== null);

// Compute the raw ingredient drawdown for producing `yieldQty` of a recipe
// against the given live inventory. Returns the per-ingredient consumption plus
// any shortfalls (where live stock can't cover the required draw).
export function computePrepDraw(
  recipe: PrepRecipe,
  yieldQty: number,
  items: InventoryItem[],
): { consumed: PrepConsumption[]; shortfalls: PrepConsumption[] } {
  const consumed: PrepConsumption[] = [];
  const shortfalls: PrepConsumption[] = [];
  for (const ri of recipe.ingredients) {
    const item = items.find((i) => i.id === ri.inventoryId);
    if (!item) continue;
    const qty = Math.round(ri.qtyPerYieldUnit * yieldQty * 1000) / 1000;
    consumed.push({
      inventoryId: item.id,
      name: item.name,
      qty,
      unit: item.unit,
    });
    if (qty > item.stock) {
      shortfalls.push({
        inventoryId: item.id,
        name: item.name,
        qty: Math.round((qty - item.stock) * 1000) / 1000,
        unit: item.unit,
      });
    }
  }
  return { consumed, shortfalls };
}
