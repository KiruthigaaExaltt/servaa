export type Zone = "All" | "Main Hall" | "Garden" | "Bar" | "Private Dining" | "Delivery";

export type DateRangeId = "today" | "7d" | "30d" | "month" | "custom";

export const ZONES: Zone[] = ["All", "Main Hall", "Garden", "Bar", "Private Dining", "Delivery"];

/* ---------- Sales ---------- */
// Hourly sales heatmap: 7 days × 14 service hours (10 AM .. 11 PM)
// Numbers are in INR.
const HOURS = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function buildHeatmap(): number[][] {
  // deterministic-ish synthetic data
  const data: number[][] = [];
  for (let d = 0; d < 7; d++) {
    const row: number[] = [];
    for (let h = 0; h < 14; h++) {
      const hourActual = h + 10;
      const lunchPeak = Math.max(0, 1 - Math.abs(hourActual - 13) / 2.5);
      const dinnerPeak = Math.max(0, 1 - Math.abs(hourActual - 20) / 2.8);
      const dayMult = [0.8, 0.85, 0.9, 1.0, 1.25, 1.4, 1.15][d];
      const base = 800 + lunchPeak * 7800 + dinnerPeak * 12500;
      const wobble = ((d * 31 + h * 17) % 13) / 13;
      row.push(Math.round(base * dayMult * (0.85 + wobble * 0.3)));
    }
    data.push(row);
  }
  return data;
}

export const HEATMAP_HOURS = HOURS;
export const HEATMAP_DAYS = DAYS;
export const HEATMAP_DATA = buildHeatmap();

export interface CategoryPerf {
  name: string;
  revenue: number;
  cogs: number;
  units: number;
}

export const CATEGORY_PERF: CategoryPerf[] = [
  { name: "Mains", revenue: 184500, cogs: 64575, units: 412 },
  { name: "Appetisers", revenue: 92800, cogs: 27840, units: 386 },
  { name: "Pizza", revenue: 71200, cogs: 21360, units: 168 },
  { name: "Drinks · Bar", revenue: 138900, cogs: 38892, units: 624 },
  { name: "Drinks · NA", revenue: 28400, cogs: 7100, units: 412 },
  { name: "Desserts", revenue: 41600, cogs: 14560, units: 220 },
  { name: "Sides", revenue: 18200, cogs: 5460, units: 290 },
];

export interface PaymentSplit {
  method: "Cash" | "UPI" | "Card" | "Wallet";
  value: number;
  txns: number;
}

export const PAYMENT_SPLIT: PaymentSplit[] = [
  { method: "UPI", value: 248600, txns: 612 },
  { method: "Card", value: 192400, txns: 318 },
  { method: "Cash", value: 84200, txns: 286 },
  { method: "Wallet", value: 28800, txns: 92 },
];

export const PAYMENT_TONE: Record<PaymentSplit["method"], string> = {
  UPI: "bg-emerald-500",
  Card: "bg-blue-500",
  Cash: "bg-amber-500",
  Wallet: "bg-purple-500",
};

/* ---------- Operations ---------- */
export interface KdsCategoryStat {
  category: string;
  avgMin: number;
  p90Min: number;
  orders: number;
  station: string;
}

export const KDS_CATEGORY_STATS: KdsCategoryStat[] = [
  { category: "Pizza", avgMin: 12, p90Min: 18, orders: 168, station: "Pizza Oven" },
  { category: "Grill / Tandoor", avgMin: 14, p90Min: 22, orders: 220, station: "Tandoor" },
  { category: "Pasta", avgMin: 9, p90Min: 14, orders: 142, station: "Pasta" },
  { category: "Salads / Cold", avgMin: 5, p90Min: 8, orders: 184, station: "Garde Manger" },
  { category: "Desserts", avgMin: 4, p90Min: 7, orders: 220, station: "Pastry" },
  { category: "Bar", avgMin: 3, p90Min: 6, orders: 624, station: "Bar" },
];

export interface TurnoverRow {
  zone: Exclude<Zone, "All">;
  avgMin: number;
  covers: number;
  turns: number;
}

export const TURNOVER: TurnoverRow[] = [
  { zone: "Main Hall", avgMin: 78, covers: 312, turns: 2.4 },
  { zone: "Garden", avgMin: 92, covers: 184, turns: 1.9 },
  { zone: "Bar", avgMin: 54, covers: 248, turns: 3.6 },
  { zone: "Private Dining", avgMin: 124, covers: 96, turns: 1.4 },
  { zone: "Delivery", avgMin: 0, covers: 412, turns: 0 },
];

export interface VoidEntry {
  id: string;
  at: number;
  table: string;
  item: string;
  qty: number;
  amount: number;
  reason: string;
  approvedBy: string;
}

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

export const VOIDS: VoidEntry[] = [
  {
    id: "VD-2041",
    at: now - 0.2 * D,
    table: "T-12 · Garden",
    item: "Margherita Pizza",
    qty: 1,
    amount: 420,
    reason: "Guest changed mind",
    approvedBy: "Priya Nair",
  },
  {
    id: "VD-2040",
    at: now - 0.4 * D,
    table: "T-04 · Main Hall",
    item: "Old Fashioned",
    qty: 2,
    amount: 880,
    reason: "Wrong order taken",
    approvedBy: "Rohan Mehta",
  },
  {
    id: "VD-2039",
    at: now - 1.1 * D,
    table: "T-08 · Bar",
    item: "Mojito",
    qty: 1,
    amount: 320,
    reason: "Spilled by server",
    approvedBy: "Priya Nair",
  },
  {
    id: "VD-2038",
    at: now - 1.6 * D,
    table: "DLV-3034",
    item: "Veg Biryani",
    qty: 1,
    amount: 340,
    reason: "Late delivery refund",
    approvedBy: "Rohan Mehta",
  },
  {
    id: "VD-2037",
    at: now - 2.3 * D,
    table: "T-16 · Private Dining",
    item: "Grilled Salmon",
    qty: 1,
    amount: 680,
    reason: "Cooked incorrectly · refire",
    approvedBy: "Suresh Iyer",
  },
  {
    id: "VD-2036",
    at: now - 3 * D,
    table: "T-02 · Main Hall",
    item: "Garlic Naan",
    qty: 4,
    amount: 240,
    reason: "Burnt batch",
    approvedBy: "Priya Nair",
  },
];

/* ---------- Tax & Compliance ---------- */
export interface GstMonth {
  month: string; // YYYY-MM
  taxable: number;
}

export const GST_MONTHS: GstMonth[] = [
  { month: "2025-12", taxable: 1284000 },
  { month: "2026-01", taxable: 1142000 },
  { month: "2026-02", taxable: 1098000 },
  { month: "2026-03", taxable: 1356000 },
  { month: "2026-04", taxable: 1428000 },
  { month: "2026-05", taxable: 482000 }, // current month so far
];

export interface DiscountImpact {
  source: string;
  redemptions: number;
  discountValue: number;
  attributedRevenue: number;
}

export const DISCOUNT_IMPACT: DiscountImpact[] = [
  {
    source: "Loyalty Points",
    redemptions: 318,
    discountValue: 18420,
    attributedRevenue: 184600,
  },
  {
    source: "FREE-DESSERT",
    redemptions: 138,
    discountValue: 16560,
    attributedRevenue: 142800,
  },
  {
    source: "FLAT-200-OFF",
    redemptions: 244,
    discountValue: 48800,
    attributedRevenue: 422400,
  },
  {
    source: "WELCOME-BACK",
    redemptions: 27,
    discountValue: 13500,
    attributedRevenue: 84200,
  },
  {
    source: "BDAY-20",
    redemptions: 31,
    discountValue: 9920,
    attributedRevenue: 49680,
  },
  {
    source: "Manager Comp",
    redemptions: 18,
    discountValue: 6450,
    attributedRevenue: 0,
  },
];

/* ---------- Staff ---------- */
export interface StaffPerf {
  id: string;
  name: string;
  role: "Waiter" | "Bartender" | "Cashier" | "Rider";
  covers: number;
  revenue: number;
  tips: number;
  upsells: number;
  rating: number;
}

export const STAFF_PERF: StaffPerf[] = [
  {
    id: "EMP-005",
    name: "Anil Kumar",
    role: "Waiter",
    covers: 184,
    revenue: 162400,
    tips: 4860,
    upsells: 38,
    rating: 4.7,
  },
  {
    id: "EMP-006",
    name: "Meera Joshi",
    role: "Waiter",
    covers: 168,
    revenue: 142200,
    tips: 3920,
    upsells: 31,
    rating: 4.5,
  },
  {
    id: "EMP-007",
    name: "Vikram Shetty",
    role: "Waiter",
    covers: 124,
    revenue: 98400,
    tips: 2980,
    upsells: 22,
    rating: 4.3,
  },
  {
    id: "EMP-008",
    name: "Sara Khan",
    role: "Bartender",
    covers: 248,
    revenue: 138900,
    tips: 5240,
    upsells: 64,
    rating: 4.8,
  },
  {
    id: "EMP-009",
    name: "Anita Desai",
    role: "Cashier",
    covers: 412,
    revenue: 482000,
    tips: 0,
    upsells: 0,
    rating: 4.6,
  },
  {
    id: "EMP-010",
    name: "Arjun Mehta",
    role: "Rider",
    covers: 142,
    revenue: 0,
    tips: 1860,
    upsells: 0,
    rating: 4.8,
  },
];

/* ---------- Helpers ---------- */
export function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function formatINRShort(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)}Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
}

export const DATE_RANGES: { id: DateRangeId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "month", label: "This Month" },
  { id: "custom", label: "Custom" },
];

// Multipliers applied to baseline data depending on selected range
export const RANGE_MULT: Record<DateRangeId, number> = {
  today: 0.18,
  "7d": 1,
  "30d": 4.1,
  month: 3.6,
  custom: 1.4,
};

export const ZONE_MULT: Record<Zone, number> = {
  All: 1,
  "Main Hall": 0.42,
  Garden: 0.18,
  Bar: 0.22,
  "Private Dining": 0.12,
  Delivery: 0.06,
};
