export type CrewRole =
  | "Admin"
  | "Manager"
  | "Head Chef"
  | "Sous Chef"
  | "Waiter"
  | "Bartender"
  | "Cashier"
  | "Rider"
  | "Cleaner";

export type CrewStatus = "On Duty" | "Off Duty" | "On Leave";

export type Zone = "Main Hall" | "Garden" | "Bar" | "Private Dining" | "Kitchen" | "Delivery";

export type ShiftSlot = "Morning" | "Evening" | "Night";

export interface ShiftAssignment {
  day: number; // 0..6 (Mon..Sun)
  slot: ShiftSlot;
  zone: Zone;
}

export interface PunchEntry {
  inAt: number;
  outAt?: number;
}

export interface Employee {
  id: string;
  name: string;
  role: CrewRole;
  status: CrewStatus;
  phone: string;
  email: string;
  joinedAt: string;
  baseSalary: number;
  hourlyRate: number;
  rating: number;
  hoursThisWeek: number;
  tipsThisMonth: number;
  paid: boolean;
  shifts: ShiftAssignment[];
  punches: PunchEntry[];
}

const D = 24 * 60 * 60 * 1000;
const H = 60 * 60 * 1000;
const now = Date.now();

function todayAt(h: number, m = 0): number {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export const SHIFT_SLOTS: { id: ShiftSlot; label: string; range: string }[] = [
  { id: "Morning", label: "Morning", range: "8 AM – 4 PM" },
  { id: "Evening", label: "Evening", range: "4 PM – 12 AM" },
  { id: "Night", label: "Night", range: "12 AM – 8 AM" },
];

export const ZONES: Zone[] = [
  "Main Hall",
  "Garden",
  "Bar",
  "Private Dining",
  "Kitchen",
  "Delivery",
];

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const ROLE_TONE: Record<CrewRole, string> = {
  Admin: "bg-violet-50 text-violet-700 ring-violet-200",
  Manager: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Head Chef": "bg-red-50 text-red-700 ring-red-200",
  "Sous Chef": "bg-orange-50 text-orange-700 ring-orange-200",
  Waiter: "bg-blue-50 text-blue-700 ring-blue-200",
  Bartender: "bg-purple-50 text-purple-700 ring-purple-200",
  Cashier: "bg-teal-50 text-teal-700 ring-teal-200",
  Rider: "bg-amber-50 text-amber-700 ring-amber-200",
  Cleaner: "bg-gray-100 text-gray-600 ring-gray-200",
};

export const STATUS_TONE: Record<CrewStatus, string> = {
  "On Duty": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Off Duty": "bg-gray-100 text-gray-500 ring-gray-200",
  "On Leave": "bg-amber-50 text-amber-700 ring-amber-200",
};

export const SEED_CREW: Employee[] = [
  {
    id: "EMP-001",
    name: "Rohan Mehta",
    role: "Admin",
    status: "On Duty",
    phone: "+91 98000 11111",
    email: "rohan@servaa.io",
    joinedAt: "2022-04-12",
    baseSalary: 95000,
    hourlyRate: 0,
    rating: 4.9,
    hoursThisWeek: 42,
    tipsThisMonth: 0,
    paid: true,
    shifts: [
      { day: 0, slot: "Morning", zone: "Main Hall" },
      { day: 1, slot: "Morning", zone: "Main Hall" },
      { day: 2, slot: "Morning", zone: "Main Hall" },
      { day: 3, slot: "Morning", zone: "Main Hall" },
      { day: 4, slot: "Morning", zone: "Main Hall" },
    ],
    punches: [{ inAt: todayAt(8, 5) }],
  },
  {
    id: "EMP-002",
    name: "Priya Nair",
    role: "Manager",
    status: "On Duty",
    phone: "+91 98000 22222",
    email: "priya@servaa.io",
    joinedAt: "2022-09-01",
    baseSalary: 72000,
    hourlyRate: 0,
    rating: 4.8,
    hoursThisWeek: 46,
    tipsThisMonth: 1240,
    paid: true,
    shifts: [
      { day: 0, slot: "Evening", zone: "Main Hall" },
      { day: 1, slot: "Evening", zone: "Main Hall" },
      { day: 3, slot: "Evening", zone: "Garden" },
      { day: 4, slot: "Evening", zone: "Main Hall" },
      { day: 5, slot: "Evening", zone: "Main Hall" },
      { day: 6, slot: "Evening", zone: "Garden" },
    ],
    punches: [{ inAt: todayAt(15, 50) }],
  },
  {
    id: "EMP-003",
    name: "Chef Suresh Iyer",
    role: "Head Chef",
    status: "On Duty",
    phone: "+91 98000 33333",
    email: "suresh@servaa.io",
    joinedAt: "2021-06-18",
    baseSalary: 88000,
    hourlyRate: 0,
    rating: 5.0,
    hoursThisWeek: 50,
    tipsThisMonth: 0,
    paid: false,
    shifts: [
      { day: 0, slot: "Morning", zone: "Kitchen" },
      { day: 1, slot: "Morning", zone: "Kitchen" },
      { day: 2, slot: "Morning", zone: "Kitchen" },
      { day: 3, slot: "Morning", zone: "Kitchen" },
      { day: 4, slot: "Morning", zone: "Kitchen" },
      { day: 5, slot: "Morning", zone: "Kitchen" },
    ],
    punches: [{ inAt: todayAt(7, 45) }],
  },
  {
    id: "EMP-004",
    name: "Karan Joshi",
    role: "Sous Chef",
    status: "On Duty",
    phone: "+91 98000 44444",
    email: "karan@servaa.io",
    joinedAt: "2023-02-01",
    baseSalary: 52000,
    hourlyRate: 280,
    rating: 4.6,
    hoursThisWeek: 44,
    tipsThisMonth: 0,
    paid: false,
    shifts: [
      { day: 0, slot: "Evening", zone: "Kitchen" },
      { day: 1, slot: "Evening", zone: "Kitchen" },
      { day: 2, slot: "Evening", zone: "Kitchen" },
      { day: 4, slot: "Evening", zone: "Kitchen" },
      { day: 5, slot: "Evening", zone: "Kitchen" },
    ],
    punches: [{ inAt: todayAt(15, 30) }],
  },
  {
    id: "EMP-005",
    name: "Anil Kumar",
    role: "Waiter",
    status: "On Duty",
    phone: "+91 98000 55555",
    email: "anil@servaa.io",
    joinedAt: "2023-07-15",
    baseSalary: 28000,
    hourlyRate: 180,
    rating: 4.7,
    hoursThisWeek: 38,
    tipsThisMonth: 4860,
    paid: false,
    shifts: [
      { day: 0, slot: "Evening", zone: "Main Hall" },
      { day: 1, slot: "Evening", zone: "Main Hall" },
      { day: 2, slot: "Evening", zone: "Main Hall" },
      { day: 4, slot: "Evening", zone: "Main Hall" },
      { day: 5, slot: "Evening", zone: "Main Hall" },
    ],
    punches: [{ inAt: todayAt(15, 55) }],
  },
  {
    id: "EMP-006",
    name: "Meera Joshi",
    role: "Waiter",
    status: "On Duty",
    phone: "+91 98000 66666",
    email: "meera@servaa.io",
    joinedAt: "2023-11-02",
    baseSalary: 26000,
    hourlyRate: 175,
    rating: 4.5,
    hoursThisWeek: 36,
    tipsThisMonth: 3920,
    paid: false,
    shifts: [
      { day: 0, slot: "Morning", zone: "Garden" },
      { day: 1, slot: "Morning", zone: "Garden" },
      { day: 2, slot: "Morning", zone: "Garden" },
      { day: 3, slot: "Morning", zone: "Garden" },
      { day: 5, slot: "Morning", zone: "Garden" },
    ],
    punches: [{ inAt: todayAt(7, 58) }],
  },
  {
    id: "EMP-007",
    name: "Vikram Shetty",
    role: "Waiter",
    status: "Off Duty",
    phone: "+91 98000 77777",
    email: "vikram@servaa.io",
    joinedAt: "2024-01-20",
    baseSalary: 26000,
    hourlyRate: 175,
    rating: 4.3,
    hoursThisWeek: 32,
    tipsThisMonth: 2980,
    paid: false,
    shifts: [
      { day: 1, slot: "Evening", zone: "Garden" },
      { day: 2, slot: "Evening", zone: "Garden" },
      { day: 3, slot: "Evening", zone: "Main Hall" },
      { day: 5, slot: "Evening", zone: "Garden" },
    ],
    punches: [],
  },
  {
    id: "EMP-008",
    name: "Sara Khan",
    role: "Bartender",
    status: "On Duty",
    phone: "+91 98000 88888",
    email: "sara@servaa.io",
    joinedAt: "2023-05-10",
    baseSalary: 34000,
    hourlyRate: 210,
    rating: 4.8,
    hoursThisWeek: 40,
    tipsThisMonth: 5240,
    paid: false,
    shifts: [
      { day: 0, slot: "Evening", zone: "Bar" },
      { day: 1, slot: "Evening", zone: "Bar" },
      { day: 2, slot: "Evening", zone: "Bar" },
      { day: 3, slot: "Evening", zone: "Bar" },
      { day: 4, slot: "Evening", zone: "Bar" },
    ],
    punches: [{ inAt: todayAt(15, 45) }],
  },
  {
    id: "EMP-009",
    name: "Anita Desai",
    role: "Cashier",
    status: "On Duty",
    phone: "+91 98000 99999",
    email: "anita@servaa.io",
    joinedAt: "2022-12-01",
    baseSalary: 30000,
    hourlyRate: 0,
    rating: 4.6,
    hoursThisWeek: 40,
    tipsThisMonth: 0,
    paid: true,
    shifts: [
      { day: 0, slot: "Morning", zone: "Main Hall" },
      { day: 1, slot: "Morning", zone: "Main Hall" },
      { day: 2, slot: "Morning", zone: "Main Hall" },
      { day: 3, slot: "Morning", zone: "Main Hall" },
      { day: 4, slot: "Morning", zone: "Main Hall" },
    ],
    punches: [{ inAt: todayAt(8, 0) }],
  },
  {
    id: "EMP-010",
    name: "Arjun Mehta",
    role: "Rider",
    status: "On Duty",
    phone: "+91 90000 11122",
    email: "arjun@servaa.io",
    joinedAt: "2023-03-15",
    baseSalary: 22000,
    hourlyRate: 150,
    rating: 4.8,
    hoursThisWeek: 42,
    tipsThisMonth: 1860,
    paid: false,
    shifts: [
      { day: 0, slot: "Evening", zone: "Delivery" },
      { day: 1, slot: "Evening", zone: "Delivery" },
      { day: 2, slot: "Evening", zone: "Delivery" },
      { day: 3, slot: "Evening", zone: "Delivery" },
      { day: 5, slot: "Evening", zone: "Delivery" },
    ],
    punches: [{ inAt: todayAt(15, 30) }],
  },
  {
    id: "EMP-011",
    name: "Rahul Pawar",
    role: "Rider",
    status: "On Leave",
    phone: "+91 90000 33344",
    email: "rahul@servaa.io",
    joinedAt: "2023-08-22",
    baseSalary: 22000,
    hourlyRate: 150,
    rating: 4.6,
    hoursThisWeek: 0,
    tipsThisMonth: 980,
    paid: false,
    shifts: [],
    punches: [],
  },
  {
    id: "EMP-012",
    name: "Lakshmi Pillai",
    role: "Cleaner",
    status: "Off Duty",
    phone: "+91 90000 44455",
    email: "lakshmi@servaa.io",
    joinedAt: "2022-08-04",
    baseSalary: 18000,
    hourlyRate: 120,
    rating: 4.4,
    hoursThisWeek: 36,
    tipsThisMonth: 0,
    paid: true,
    shifts: [
      { day: 0, slot: "Night", zone: "Kitchen" },
      { day: 1, slot: "Night", zone: "Kitchen" },
      { day: 2, slot: "Night", zone: "Main Hall" },
      { day: 3, slot: "Night", zone: "Kitchen" },
      { day: 4, slot: "Night", zone: "Main Hall" },
    ],
    punches: [
      { inAt: now - 16 * H, outAt: now - 8 * H },
    ],
  },
];

/* ---------- Permissions ---------- */
export type Permission =
  | "view_inventory_prices"
  | "view_food_costs"
  | "edit_menu"
  | "process_refunds"
  | "view_payroll"
  | "view_kots"
  | "edit_roster"
  | "view_reports";

export const ALL_PERMISSIONS: { id: Permission; label: string; group: string }[] = [
  { id: "view_kots", label: "View KOTs / KDS", group: "Operations" },
  { id: "edit_roster", label: "Edit Crew Roster", group: "Operations" },
  { id: "view_inventory_prices", label: "See Inventory Prices", group: "Inventory" },
  { id: "view_food_costs", label: "See BOH Food Costs", group: "Inventory" },
  { id: "edit_menu", label: "Edit Menu & Pricing", group: "Catalog" },
  { id: "process_refunds", label: "Process Refunds", group: "Finance" },
  { id: "view_reports", label: "View Reports & Analytics", group: "Finance" },
  { id: "view_payroll", label: "View Payroll & Salaries", group: "Finance" },
];

export const SEED_PERMISSIONS: Record<CrewRole, Permission[]> = {
  Admin: ALL_PERMISSIONS.map((p) => p.id),
  Manager: [
    "view_kots",
    "edit_roster",
    "view_inventory_prices",
    "view_food_costs",
    "edit_menu",
    "process_refunds",
    "view_reports",
  ],
  "Head Chef": ["view_kots", "view_inventory_prices", "view_food_costs"],
  "Sous Chef": ["view_kots", "view_inventory_prices"],
  Waiter: ["view_kots"],
  Bartender: ["view_kots"],
  Cashier: ["view_kots", "process_refunds"],
  Rider: [],
  Cleaner: [],
};

/* ---------- Helpers ---------- */
export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function sessionDuration(p?: PunchEntry): string {
  if (!p) return "—";
  const end = p.outAt ?? Date.now();
  const min = Math.floor((end - p.inAt) / 60000);
  const h = Math.floor(min / 60);
  return `${h}h ${min % 60}m`;
}

export function payoutForMonth(e: Employee): {
  base: number;
  tips: number;
  total: number;
} {
  return {
    base: e.baseSalary,
    tips: e.tipsThisMonth,
    total: e.baseSalary + e.tipsThisMonth,
  };
}
