export type InventoryUnit = "KG" | "G" | "Ltrs" | "ML" | "Pkts" | "Pcs" | "Btls";

export type InventoryCategory =
  | "Grains"
  | "Dairy"
  | "Meat"
  | "Produce"
  | "Spices"
  | "Beverages"
  | "Bakery"
  | "Oils"
  | "Seafood";

export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  stock: number;
  minLevel: number;
  unit: InventoryUnit;
  unitPrice: number;
  lastRestocked: string; // ISO date
  supplierName: string;
  supplierContact: string;
}

const today = new Date();
function daysAgo(d: number): string {
  const t = new Date(today);
  t.setDate(t.getDate() - d);
  return t.toISOString().slice(0, 10);
}

export const SEED_INVENTORY: InventoryItem[] = [
  {
    id: "inv-001",
    name: "Basmati Rice",
    category: "Grains",
    stock: 48,
    minLevel: 25,
    unit: "KG",
    unitPrice: 95,
    lastRestocked: daysAgo(3),
    supplierName: "Sona Agro Mills",
    supplierContact: "+91 98200 11223",
  },
  {
    id: "inv-002",
    name: "Toor Dal",
    category: "Grains",
    stock: 12,
    minLevel: 15,
    unit: "KG",
    unitPrice: 138,
    lastRestocked: daysAgo(9),
    supplierName: "Sona Agro Mills",
    supplierContact: "+91 98200 11223",
  },
  {
    id: "inv-003",
    name: "Full Cream Milk",
    category: "Dairy",
    stock: 6,
    minLevel: 20,
    unit: "Ltrs",
    unitPrice: 62,
    lastRestocked: daysAgo(1),
    supplierName: "Amul Distribution",
    supplierContact: "+91 98765 43210",
  },
  {
    id: "inv-004",
    name: "Paneer",
    category: "Dairy",
    stock: 8.5,
    minLevel: 5,
    unit: "KG",
    unitPrice: 380,
    lastRestocked: daysAgo(2),
    supplierName: "Amul Distribution",
    supplierContact: "+91 98765 43210",
  },
  {
    id: "inv-005",
    name: "Butter (Salted)",
    category: "Dairy",
    stock: 0,
    minLevel: 4,
    unit: "KG",
    unitPrice: 540,
    lastRestocked: daysAgo(14),
    supplierName: "Amul Distribution",
    supplierContact: "+91 98765 43210",
  },
  {
    id: "inv-006",
    name: "Chicken (Boneless)",
    category: "Meat",
    stock: 22,
    minLevel: 10,
    unit: "KG",
    unitPrice: 320,
    lastRestocked: daysAgo(1),
    supplierName: "Fresh Catch Co.",
    supplierContact: "+91 99887 76655",
  },
  {
    id: "inv-007",
    name: "Mutton",
    category: "Meat",
    stock: 4,
    minLevel: 6,
    unit: "KG",
    unitPrice: 720,
    lastRestocked: daysAgo(4),
    supplierName: "Fresh Catch Co.",
    supplierContact: "+91 99887 76655",
  },
  {
    id: "inv-008",
    name: "King Prawns",
    category: "Seafood",
    stock: 0,
    minLevel: 3,
    unit: "KG",
    unitPrice: 980,
    lastRestocked: daysAgo(11),
    supplierName: "Coastal Seafoods",
    supplierContact: "+91 90909 12121",
  },
  {
    id: "inv-009",
    name: "Tomatoes",
    category: "Produce",
    stock: 18,
    minLevel: 8,
    unit: "KG",
    unitPrice: 35,
    lastRestocked: daysAgo(2),
    supplierName: "Green Valley Farms",
    supplierContact: "+91 98123 45678",
  },
  {
    id: "inv-010",
    name: "Onions",
    category: "Produce",
    stock: 32,
    minLevel: 15,
    unit: "KG",
    unitPrice: 28,
    lastRestocked: daysAgo(2),
    supplierName: "Green Valley Farms",
    supplierContact: "+91 98123 45678",
  },
  {
    id: "inv-011",
    name: "Coriander Leaves",
    category: "Produce",
    stock: 1.2,
    minLevel: 2,
    unit: "KG",
    unitPrice: 80,
    lastRestocked: daysAgo(3),
    supplierName: "Green Valley Farms",
    supplierContact: "+91 98123 45678",
  },
  {
    id: "inv-012",
    name: "Garam Masala",
    category: "Spices",
    stock: 3.5,
    minLevel: 1.5,
    unit: "KG",
    unitPrice: 620,
    lastRestocked: daysAgo(20),
    supplierName: "MDH Spices",
    supplierContact: "+91 95555 22220",
  },
  {
    id: "inv-013",
    name: "Turmeric Powder",
    category: "Spices",
    stock: 0.8,
    minLevel: 1,
    unit: "KG",
    unitPrice: 280,
    lastRestocked: daysAgo(18),
    supplierName: "MDH Spices",
    supplierContact: "+91 95555 22220",
  },
  {
    id: "inv-014",
    name: "Refined Sunflower Oil",
    category: "Oils",
    stock: 25,
    minLevel: 12,
    unit: "Ltrs",
    unitPrice: 145,
    lastRestocked: daysAgo(5),
    supplierName: "Fortune Foods",
    supplierContact: "+91 91234 56789",
  },
  {
    id: "inv-015",
    name: "Ghee",
    category: "Dairy",
    stock: 9,
    minLevel: 4,
    unit: "Ltrs",
    unitPrice: 580,
    lastRestocked: daysAgo(7),
    supplierName: "Amul Distribution",
    supplierContact: "+91 98765 43210",
  },
  {
    id: "inv-016",
    name: "Wheat Flour (Atta)",
    category: "Grains",
    stock: 55,
    minLevel: 20,
    unit: "KG",
    unitPrice: 48,
    lastRestocked: daysAgo(4),
    supplierName: "Sona Agro Mills",
    supplierContact: "+91 98200 11223",
  },
  {
    id: "inv-017",
    name: "Cola 300ml",
    category: "Beverages",
    stock: 84,
    minLevel: 48,
    unit: "Btls",
    unitPrice: 22,
    lastRestocked: daysAgo(1),
    supplierName: "BevCo Distributors",
    supplierContact: "+91 90011 22334",
  },
  {
    id: "inv-018",
    name: "Mineral Water 1L",
    category: "Beverages",
    stock: 36,
    minLevel: 60,
    unit: "Btls",
    unitPrice: 14,
    lastRestocked: daysAgo(3),
    supplierName: "BevCo Distributors",
    supplierContact: "+91 90011 22334",
  },
  {
    id: "inv-019",
    name: "Burger Buns",
    category: "Bakery",
    stock: 24,
    minLevel: 30,
    unit: "Pkts",
    unitPrice: 60,
    lastRestocked: daysAgo(1),
    supplierName: "Daily Bread Bakery",
    supplierContact: "+91 99001 88776",
  },
  {
    id: "inv-020",
    name: "Pizza Dough Balls",
    category: "Bakery",
    stock: 0,
    minLevel: 20,
    unit: "Pcs",
    unitPrice: 32,
    lastRestocked: daysAgo(6),
    supplierName: "Daily Bread Bakery",
    supplierContact: "+91 99001 88776",
  },
];

export type StockStatus = "In Stock" | "Low" | "Out";

export function statusOf(item: InventoryItem): StockStatus {
  if (item.stock <= 0) return "Out";
  if (item.stock <= item.minLevel) return "Low";
  return "In Stock";
}

export function formatRelativeDate(iso: string): string {
  const then = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return then.toLocaleDateString();
}
