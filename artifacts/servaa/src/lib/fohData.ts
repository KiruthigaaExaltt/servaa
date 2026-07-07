export type TableStatus =
  | "Vacant"
  | "Occupied"
  | "Reserved"
  | "Cleaning"
  | "Maintenance"
  | "Waiting for Settlement";
export type TableArea = "Main Hall" | "Garden Area" | "VIP Section";

export interface FloorTable {
  id: string;
  area: TableArea;
  capacity: number;
  status: TableStatus;
  pax?: number;
  waiterName?: string;
  customerName?: string;
  occupiedSince?: number;
  reservationTime?: string;
  reservationName?: string;
  maintenanceNote?: string;
}

export type ReservationStatus = "Confirmed" | "Pending" | "Seated";

export interface Reservation {
  id: string;
  guestName: string;
  phone: string;
  pax: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  status: ReservationStatus;
  isSpecial?: boolean;
  note?: string;
  seatedTableId?: string;
}

export interface WaitlistEntry {
  id: string;
  guestName: string;
  phone: string;
  pax: number;
  quotedWait: number; // minutes
  joinedAt: number; // ms
  note?: string;
}

export type TipPaymentMethod = "Cash" | "Card" | "UPI";

export interface TipEntry {
  id: string;
  staff: string;
  amount: number;
  time: number;
  tableId: string;
  orderTotal: number;
  paymentMethod: TipPaymentMethod;
}

export interface QRCard {
  tableId: string;
  code: string;
  menuVersion: string;
  lastUsed: number;
}

const now = Date.now();

export const SEED_TABLES: FloorTable[] = [
  // Main Hall
  { id: "T-1", area: "Main Hall", capacity: 2, status: "Occupied", pax: 2, waiterName: "Anita", customerName: "Mr. Sharma", occupiedSince: now - 45 * 60 * 1000 },
  { id: "T-2", area: "Main Hall", capacity: 4, status: "Vacant" },
  { id: "T-3", area: "Main Hall", capacity: 4, status: "Occupied", pax: 3, waiterName: "Priya", customerName: "Walk-in", occupiedSince: now - 22 * 60 * 1000 },
  { id: "T-4", area: "Main Hall", capacity: 4, status: "Cleaning" },
  { id: "T-5", area: "Main Hall", capacity: 6, status: "Occupied", pax: 5, waiterName: "Anita", customerName: "Patel Family", occupiedSince: now - 12 * 60 * 1000 },
  { id: "T-6", area: "Main Hall", capacity: 2, status: "Reserved", reservationTime: "20:00", reservationName: "Neha Singh" },
  { id: "T-7", area: "Main Hall", capacity: 2, status: "Vacant" },
  { id: "T-8", area: "Main Hall", capacity: 4, status: "Maintenance", maintenanceNote: "Wobbly leg" },
  // Garden Area
  { id: "T-9", area: "Garden Area", capacity: 4, status: "Vacant" },
  { id: "T-10", area: "Garden Area", capacity: 6, status: "Occupied", pax: 4, waiterName: "Ravi", customerName: "Mr. Khan", occupiedSince: now - 65 * 60 * 1000 },
  { id: "T-11", area: "Garden Area", capacity: 2, status: "Vacant" },
  { id: "T-12", area: "Garden Area", capacity: 8, status: "Reserved", reservationTime: "20:15", reservationName: "Rohan Desai" },
  // VIP Section
  { id: "V-1", area: "VIP Section", capacity: 6, status: "Vacant" },
  { id: "V-2", area: "VIP Section", capacity: 8, status: "Occupied", pax: 6, waiterName: "Suresh", customerName: "Mehta Group", occupiedSince: now - 30 * 60 * 1000 },
  { id: "V-3", area: "VIP Section", capacity: 10, status: "Reserved", reservationTime: "21:00", reservationName: "Iyer Anniversary" },
  { id: "V-4", area: "VIP Section", capacity: 4, status: "Cleaning" },
];

const TODAY = new Date().toISOString().slice(0, 10);

export const SEED_RESERVATIONS: Reservation[] = [
  { id: "r-1", guestName: "Aarav Mehta", phone: "+91 98765 43210", pax: 4, date: TODAY, time: "19:30", status: "Confirmed" },
  { id: "r-2", guestName: "Neha Singh", phone: "+91 99876 55432", pax: 2, date: TODAY, time: "20:00", status: "Confirmed", isSpecial: true, note: "Anniversary — cake at 20:30, window seat preferred" },
  { id: "r-3", guestName: "Rohan Desai", phone: "+91 97654 12345", pax: 6, date: TODAY, time: "20:15", status: "Pending", note: "Awaiting deposit confirmation" },
  { id: "r-4", guestName: "Priya Iyer", phone: "+91 91234 56789", pax: 3, date: TODAY, time: "21:00", status: "Confirmed", note: "Vegetarian menu" },
  { id: "r-5", guestName: "Mr. Sharma", phone: "+91 99887 76655", pax: 2, date: TODAY, time: "19:00", status: "Seated", seatedTableId: "T-1" },
  { id: "r-6", guestName: "Iyer Anniversary", phone: "+91 98321 11223", pax: 8, date: TODAY, time: "21:00", status: "Confirmed", isSpecial: true, note: "VIP booth, champagne service" },
];

export const SEED_WAITLIST: WaitlistEntry[] = [
  { id: "w-1", guestName: "Karan Joshi", phone: "+91 90000 11111", pax: 3, quotedWait: 15, joinedAt: now - 6 * 60 * 1000 },
  { id: "w-2", guestName: "Sara Khan", phone: "+91 90000 22222", pax: 2, quotedWait: 25, joinedAt: now - 12 * 60 * 1000, note: "Outdoor seating preferred" },
  { id: "w-3", guestName: "Vikram Rao", phone: "+91 90000 33333", pax: 5, quotedWait: 40, joinedAt: now - 3 * 60 * 1000 },
];

export const SEED_TIPS: TipEntry[] = [
  { id: "tip-1", staff: "Anita", amount: 250, time: now - 90 * 60 * 1000, tableId: "T-1", orderTotal: 2350, paymentMethod: "Card" },
  { id: "tip-2", staff: "Priya", amount: 120, time: now - 40 * 60 * 1000, tableId: "T-3", orderTotal: 1200, paymentMethod: "UPI" },
  { id: "tip-3", staff: "Ravi", amount: 300, time: now - 10 * 60 * 1000, tableId: "T-10", orderTotal: 3000, paymentMethod: "Cash" },
  { id: "tip-4", staff: "Suresh", amount: 450, time: now - 25 * 60 * 1000, tableId: "V-2", orderTotal: 4500, paymentMethod: "Card" },
  { id: "tip-5", staff: "Anita", amount: 80, time: now - 5 * 60 * 1000, tableId: "T-5", orderTotal: 1600, paymentMethod: "UPI" },
];

export const SEED_QRS: QRCard[] = SEED_TABLES.map((t, i) => ({
  tableId: t.id,
  code: `SRV-${t.id.replace(/[A-Z]-/, "").padStart(3, "0")}-${(1000 + i).toString(16).toUpperCase()}`,
  menuVersion: "v2.4.1",
  lastUsed: now - (i + 1) * 17 * 60 * 1000,
}));
