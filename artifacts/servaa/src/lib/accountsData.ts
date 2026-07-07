export type PaymentMode = "Cash" | "UPI" | "Card" | "Wallet" | "Adjustment";

export type ExpenseCategory =
  | "Groceries"
  | "Utilities"
  | "Maintenance"
  | "Staff Advance"
  | "Rent"
  | "Marketing"
  | "Misc";

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Groceries",
  "Utilities",
  "Maintenance",
  "Staff Advance",
  "Rent",
  "Marketing",
  "Misc",
];

export const CATEGORY_TONE: Record<ExpenseCategory, string> = {
  Groceries: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Utilities: "bg-blue-50 text-blue-700 ring-blue-200",
  Maintenance: "bg-amber-50 text-amber-700 ring-amber-200",
  "Staff Advance": "bg-purple-50 text-purple-700 ring-purple-200",
  Rent: "bg-rose-50 text-rose-700 ring-rose-200",
  Marketing: "bg-orange-50 text-orange-700 ring-orange-200",
  Misc: "bg-gray-100 text-gray-600 ring-gray-200",
};

export const PAYMENT_TONE: Record<PaymentMode, string> = {
  Cash: "bg-amber-50 text-amber-700 ring-amber-200",
  UPI: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  Card: "bg-blue-50 text-blue-700 ring-blue-200",
  Wallet: "bg-purple-50 text-purple-700 ring-purple-200",
  Adjustment: "bg-slate-100 text-slate-600 ring-slate-200",
};

export interface IncomeRow {
  id: string;
  at: number;
  table: string;
  amount: number;
  mode: PaymentMode;
  server: string;
}

export interface ExpenseRow {
  id: string;
  at: number;
  description: string;
  category: ExpenseCategory;
  amount: number;
  mode: PaymentMode;
  hasBill: boolean;
  paidTo?: string;
}

export interface VendorPayout {
  id: string;
  poId: string;
  vendor: string;
  category: string;
  amount: number;
  paid: number;
  dueAt: number;
  status: "Paid" | "Partially Paid" | "Pending" | "Overdue";
}

export interface PnLMonth {
  month: string; // YYYY-MM
  revenue: number;
  cogs: number;
  salaries: number;
  rent: number;
  utilities: number;
  marketing: number;
  other: number;
}

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

function todayAt(h: number, m = 0): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const OPENING_FLOAT = 5000;

export const SEED_INCOME: IncomeRow[] = [
  { id: "BIL-3041", at: todayAt(13, 12), table: "T-04 · Main Hall", amount: 2840, mode: "UPI", server: "Anil Kumar" },
  { id: "BIL-3042", at: todayAt(13, 38), table: "T-09 · Garden", amount: 1640, mode: "Cash", server: "Meera Joshi" },
  { id: "BIL-3043", at: todayAt(14, 5), table: "T-12 · Garden", amount: 4220, mode: "Card", server: "Anil Kumar" },
  { id: "BIL-3044", at: todayAt(14, 47), table: "T-02 · Main Hall", amount: 1960, mode: "UPI", server: "Meera Joshi" },
  { id: "BIL-3045", at: todayAt(15, 22), table: "T-08 · Bar", amount: 980, mode: "Cash", server: "Sara Khan" },
  { id: "BIL-3046", at: todayAt(19, 18), table: "T-11 · Main Hall", amount: 5640, mode: "Card", server: "Anil Kumar" },
  { id: "BIL-3047", at: todayAt(19, 52), table: "T-16 · Private Dining", amount: 12480, mode: "Card", server: "Priya Nair" },
  { id: "BIL-3048", at: todayAt(20, 14), table: "T-05 · Main Hall", amount: 3280, mode: "UPI", server: "Anil Kumar" },
  { id: "BIL-3049", at: todayAt(20, 41), table: "T-08 · Bar", amount: 2140, mode: "Cash", server: "Sara Khan" },
  { id: "BIL-3050", at: todayAt(21, 6), table: "DLV-3034", amount: 1820, mode: "Wallet", server: "Arjun Mehta" },
  { id: "BIL-3051", at: todayAt(21, 33), table: "T-09 · Garden", amount: 4860, mode: "UPI", server: "Meera Joshi" },
  { id: "BIL-3052", at: todayAt(22, 1), table: "T-04 · Main Hall", amount: 3140, mode: "Card", server: "Anil Kumar" },
];

export const SEED_EXPENSES: ExpenseRow[] = [
  {
    id: "EXP-2210",
    at: todayAt(8, 15),
    description: "Vegetable mandi · daily run",
    category: "Groceries",
    amount: 4280,
    mode: "Cash",
    hasBill: true,
    paidTo: "Sundar Veg Supply",
  },
  {
    id: "EXP-2211",
    at: todayAt(9, 30),
    description: "BEST · electricity bill (May)",
    category: "Utilities",
    amount: 18400,
    mode: "UPI",
    hasBill: true,
    paidTo: "BEST",
  },
  {
    id: "EXP-2212",
    at: todayAt(11, 45),
    description: "AC servicing · Bar zone",
    category: "Maintenance",
    amount: 2400,
    mode: "Cash",
    hasBill: false,
    paidTo: "CoolTech Services",
  },
  {
    id: "EXP-2213",
    at: todayAt(16, 20),
    description: "Salary advance · Anil Kumar",
    category: "Staff Advance",
    amount: 5000,
    mode: "Cash",
    hasBill: true,
    paidTo: "EMP-005",
  },
  {
    id: "EXP-2214",
    at: todayAt(18, 5),
    description: "Instagram boost · weekend brunch",
    category: "Marketing",
    amount: 3500,
    mode: "Card",
    hasBill: true,
    paidTo: "Meta Ads",
  },
];

export const SEED_VENDORS: VendorPayout[] = [
  {
    id: "VP-9001",
    poId: "PO-4421",
    vendor: "Sundar Veg Supply",
    category: "Produce",
    amount: 28400,
    paid: 28400,
    dueAt: now - 4 * D,
    status: "Paid",
  },
  {
    id: "VP-9002",
    poId: "PO-4422",
    vendor: "Mumbai Meat Co.",
    category: "Proteins",
    amount: 64800,
    paid: 32000,
    dueAt: now + 2 * D,
    status: "Partially Paid",
  },
  {
    id: "VP-9003",
    poId: "PO-4423",
    vendor: "Aqua Pure Beverages",
    category: "Beverages",
    amount: 18600,
    paid: 0,
    dueAt: now + 6 * D,
    status: "Pending",
  },
  {
    id: "VP-9004",
    poId: "PO-4424",
    vendor: "Brewers' Yard",
    category: "Bar Stock",
    amount: 142000,
    paid: 70000,
    dueAt: now - 6 * D,
    status: "Overdue",
  },
  {
    id: "VP-9005",
    poId: "PO-4425",
    vendor: "Patanjali Wholesale",
    category: "Pantry",
    amount: 22300,
    paid: 0,
    dueAt: now - 2 * D,
    status: "Overdue",
  },
  {
    id: "VP-9006",
    poId: "PO-4426",
    vendor: "Crystal Gas Agency",
    category: "Utilities",
    amount: 8400,
    paid: 8400,
    dueAt: now - 12 * D,
    status: "Paid",
  },
  {
    id: "VP-9007",
    poId: "PO-4427",
    vendor: "Sundar Veg Supply",
    category: "Produce",
    amount: 12800,
    paid: 0,
    dueAt: now + 1 * D,
    status: "Pending",
  },
];

export const VENDOR_TONE: Record<VendorPayout["status"], string> = {
  Paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Partially Paid": "bg-amber-50 text-amber-700 ring-amber-200",
  Pending: "bg-blue-50 text-blue-700 ring-blue-200",
  Overdue: "bg-red-50 text-red-700 ring-red-200",
};

export const PNL_MONTHS: PnLMonth[] = [
  {
    month: "2025-12",
    revenue: 1284000,
    cogs: 372000,
    salaries: 286000,
    rent: 180000,
    utilities: 48000,
    marketing: 22000,
    other: 18000,
  },
  {
    month: "2026-01",
    revenue: 1142000,
    cogs: 332000,
    salaries: 286000,
    rent: 180000,
    utilities: 51000,
    marketing: 18000,
    other: 14000,
  },
  {
    month: "2026-02",
    revenue: 1098000,
    cogs: 318000,
    salaries: 286000,
    rent: 180000,
    utilities: 46000,
    marketing: 24000,
    other: 16000,
  },
  {
    month: "2026-03",
    revenue: 1356000,
    cogs: 392000,
    salaries: 294000,
    rent: 180000,
    utilities: 49000,
    marketing: 28000,
    other: 19000,
  },
  {
    month: "2026-04",
    revenue: 1428000,
    cogs: 412000,
    salaries: 294000,
    rent: 180000,
    utilities: 52000,
    marketing: 32000,
    other: 21000,
  },
  {
    month: "2026-05",
    revenue: 482000,
    cogs: 138000,
    salaries: 124000,
    rent: 180000,
    utilities: 28000,
    marketing: 14000,
    other: 9000,
  },
];

export const DENOMINATIONS = [2000, 500, 200, 100, 50, 20, 10] as const;

export function formatINR(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? "-" : "";
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

export function formatINRShort(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(2)}Cr`;
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}k`;
  return `${sign}₹${Math.round(abs)}`;
}
