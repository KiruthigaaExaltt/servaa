import type { OrderType } from "@/types";

export type ArchiveStatus = "Settled" | "Voided" | "Refunded";
export type ArchivePayment = "Cash" | "Card" | "UPI" | "Wallet";

export interface ArchiveLine {
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers: string[];
}

export type AuditEventKind =
  | "Ordered"
  | "KOT Sent"
  | "Ready"
  | "Served"
  | "Settled"
  | "Voided"
  | "Refunded";

export interface AuditEvent {
  kind: AuditEventKind;
  at: number; // ms
  by?: string;
  note?: string;
}

export interface ArchiveOrder {
  id: string;
  timestamp: number; // settlement / void timestamp
  source: string; // "Table 4", "Zomato", "Counter", "Swiggy"
  orderType: OrderType;
  customerName?: string;
  waiterName: string;
  lines: ArchiveLine[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  total: number;
  payment: ArchivePayment;
  status: ArchiveStatus;
  voidReason?: string;
  refundReason?: string;
  refundedAt?: number;
  audit: AuditEvent[];
}

const TAX_RATE = 0.025;

export function computeTotals(
  lines: ArchiveLine[],
  discount = 0,
): { subtotal: number; cgst: number; sgst: number; total: number } {
  const subtotal = lines.reduce(
    (s, l) => s + l.quantity * l.unitPrice,
    0,
  );
  const taxable = Math.max(0, subtotal - discount);
  const cgst = Math.round(taxable * TAX_RATE * 100) / 100;
  const sgst = Math.round(taxable * TAX_RATE * 100) / 100;
  const total = Math.round((taxable + cgst + sgst) * 100) / 100;
  return { subtotal, cgst, sgst, total };
}

const now = Date.now();
const M = 60_000;
const H = 3_600_000;
const D = 24 * H;

function buildOrder(opts: {
  id: string;
  ago: number; // ms ago for settlement
  source: string;
  orderType: OrderType;
  customerName?: string;
  waiterName: string;
  lines: ArchiveLine[];
  discount?: number;
  payment: ArchivePayment;
  status: ArchiveStatus;
  voidReason?: string;
  refundReason?: string;
  refundAgo?: number;
  prepDuration?: number; // ms from ordered to settled
}): ArchiveOrder {
  const settledAt = now - opts.ago;
  const totals = computeTotals(opts.lines, opts.discount ?? 0);
  const prep = opts.prepDuration ?? 40 * M;
  const orderedAt = settledAt - prep;
  const audit: AuditEvent[] = [
    { kind: "Ordered", at: orderedAt, by: opts.waiterName },
    { kind: "KOT Sent", at: orderedAt + 2 * M, by: opts.waiterName },
  ];
  if (opts.status === "Voided") {
    audit.push({
      kind: "Voided",
      at: settledAt,
      by: "Manager",
      note: opts.voidReason,
    });
  } else {
    audit.push(
      { kind: "Ready", at: orderedAt + Math.round(prep * 0.5), by: "Kitchen" },
      { kind: "Served", at: orderedAt + Math.round(prep * 0.7), by: opts.waiterName },
      { kind: "Settled", at: settledAt, by: opts.waiterName },
    );
    if (opts.status === "Refunded") {
      const refundedAt = settledAt + (opts.refundAgo ?? 30 * M);
      audit.push({
        kind: "Refunded",
        at: refundedAt,
        by: "Manager",
        note: opts.refundReason,
      });
    }
  }
  return {
    id: opts.id,
    timestamp: settledAt,
    source: opts.source,
    orderType: opts.orderType,
    customerName: opts.customerName,
    waiterName: opts.waiterName,
    lines: opts.lines,
    discount: opts.discount ?? 0,
    ...totals,
    payment: opts.payment,
    status: opts.status,
    voidReason: opts.voidReason,
    refundReason: opts.refundReason,
    refundedAt:
      opts.status === "Refunded"
        ? settledAt + (opts.refundAgo ?? 30 * M)
        : undefined,
    audit,
  };
}

export const SEED_ORDERS: ArchiveOrder[] = [
  buildOrder({
    id: "SRV-9942",
    ago: 35 * M,
    source: "Table 4",
    orderType: "Dine In",
    customerName: "Mr. Sharma",
    waiterName: "Anita",
    lines: [
      { name: "Paneer Butter Masala", quantity: 2, unitPrice: 320, modifiers: ["Extra Spicy"] },
      { name: "Garlic Naan", quantity: 4, unitPrice: 65, modifiers: [] },
      { name: "Jeera Rice", quantity: 1, unitPrice: 220, modifiers: [] },
      { name: "Mango Lassi", quantity: 2, unitPrice: 140, modifiers: ["Less Sugar"] },
    ],
    payment: "UPI",
    status: "Settled",
  }),
  buildOrder({
    id: "SRV-9941",
    ago: 1 * H + 20 * M,
    source: "Zomato",
    orderType: "Delivery",
    customerName: "Ritu Verma",
    waiterName: "System",
    lines: [
      { name: "Chicken Biryani", quantity: 1, unitPrice: 380, modifiers: ["Boneless"] },
      { name: "Raita", quantity: 1, unitPrice: 60, modifiers: [] },
      { name: "Gulab Jamun (2pc)", quantity: 1, unitPrice: 90, modifiers: [] },
    ],
    payment: "Wallet",
    status: "Settled",
    prepDuration: 28 * M,
  }),
  buildOrder({
    id: "SRV-9940",
    ago: 2 * H,
    source: "Table 7",
    orderType: "Dine In",
    customerName: "Walk-in",
    waiterName: "Priya",
    lines: [
      { name: "Margherita Pizza (Large)", quantity: 1, unitPrice: 480, modifiers: ["+ Extra Cheese"] },
      { name: "Veg Spring Rolls", quantity: 1, unitPrice: 220, modifiers: [] },
      { name: "Cold Coffee", quantity: 2, unitPrice: 160, modifiers: [] },
    ],
    discount: 50,
    payment: "Card",
    status: "Settled",
  }),
  buildOrder({
    id: "SRV-9939",
    ago: 2 * H + 45 * M,
    source: "Counter",
    orderType: "Takeaway",
    customerName: "Aman",
    waiterName: "Suresh",
    lines: [
      { name: "Chicken Tikka", quantity: 1, unitPrice: 340, modifiers: [] },
      { name: "Butter Naan", quantity: 2, unitPrice: 60, modifiers: [] },
    ],
    payment: "Cash",
    status: "Voided",
    voidReason: "Customer changed mind",
    prepDuration: 8 * M,
  }),
  buildOrder({
    id: "SRV-9938",
    ago: 3 * H,
    source: "Swiggy",
    orderType: "Delivery",
    customerName: "Neha S.",
    waiterName: "System",
    lines: [
      { name: "Veg Thali", quantity: 2, unitPrice: 280, modifiers: [] },
      { name: "Sweet Lassi", quantity: 2, unitPrice: 120, modifiers: [] },
    ],
    payment: "Wallet",
    status: "Refunded",
    refundReason: "Late delivery — partial refund issued",
    refundAgo: 25 * M,
  }),
  buildOrder({
    id: "SRV-9937",
    ago: 3 * H + 30 * M,
    source: "Table 12",
    orderType: "Dine In",
    customerName: "Kapoor Family",
    waiterName: "Ravi",
    lines: [
      { name: "Tandoori Platter", quantity: 1, unitPrice: 720, modifiers: ["No Mint Chutney"] },
      { name: "Dal Makhani", quantity: 1, unitPrice: 280, modifiers: [] },
      { name: "Jeera Rice", quantity: 2, unitPrice: 220, modifiers: [] },
      { name: "Garlic Naan", quantity: 6, unitPrice: 65, modifiers: [] },
      { name: "Fresh Lime Soda", quantity: 4, unitPrice: 110, modifiers: ["Salted"] },
    ],
    discount: 100,
    payment: "Card",
    status: "Settled",
    prepDuration: 55 * M,
  }),
  buildOrder({
    id: "SRV-9936",
    ago: 4 * H,
    source: "Table 2",
    orderType: "Dine In",
    waiterName: "Anita",
    lines: [
      { name: "Cheese Sandwich", quantity: 2, unitPrice: 180, modifiers: [] },
      { name: "Masala Chai", quantity: 2, unitPrice: 60, modifiers: [] },
    ],
    payment: "UPI",
    status: "Settled",
    prepDuration: 18 * M,
  }),
  buildOrder({
    id: "SRV-9935",
    ago: 5 * H,
    source: "Drive Thru",
    orderType: "Drive Thru",
    customerName: "Mr. Bose",
    waiterName: "Karan",
    lines: [
      { name: "Classic Burger", quantity: 2, unitPrice: 220, modifiers: ["+ Cheese"] },
      { name: "French Fries (Large)", quantity: 1, unitPrice: 160, modifiers: [] },
      { name: "Cola 300ml", quantity: 2, unitPrice: 80, modifiers: [] },
    ],
    payment: "Card",
    status: "Settled",
    prepDuration: 12 * M,
  }),
  buildOrder({
    id: "SRV-9934",
    ago: 6 * H,
    source: "Table 9",
    orderType: "Dine In",
    customerName: "Sneha",
    waiterName: "Priya",
    lines: [
      { name: "Caesar Salad", quantity: 1, unitPrice: 260, modifiers: ["No Croutons"] },
      { name: "Grilled Fish", quantity: 1, unitPrice: 460, modifiers: [] },
    ],
    payment: "Card",
    status: "Voided",
    voidReason: "Wrong entry — duplicate KOT",
    prepDuration: 6 * M,
  }),
  buildOrder({
    id: "SRV-9933",
    ago: 7 * H + 15 * M,
    source: "Zomato",
    orderType: "Delivery",
    customerName: "R. Iyer",
    waiterName: "System",
    lines: [
      { name: "Hakka Noodles", quantity: 1, unitPrice: 240, modifiers: ["Schezwan"] },
      { name: "Chilli Paneer", quantity: 1, unitPrice: 280, modifiers: [] },
      { name: "Coke 500ml", quantity: 1, unitPrice: 60, modifiers: [] },
    ],
    payment: "Wallet",
    status: "Settled",
    prepDuration: 30 * M,
  }),
  buildOrder({
    id: "SRV-9932",
    ago: 1 * D + 1 * H,
    source: "Table 5",
    orderType: "Dine In",
    customerName: "Patel Family",
    waiterName: "Anita",
    lines: [
      { name: "Family Veg Combo", quantity: 1, unitPrice: 1180, modifiers: [] },
      { name: "Kulfi", quantity: 4, unitPrice: 120, modifiers: ["Pista"] },
    ],
    discount: 80,
    payment: "Cash",
    status: "Settled",
  }),
  buildOrder({
    id: "SRV-9931",
    ago: 1 * D + 3 * H,
    source: "Table 1",
    orderType: "Dine In",
    customerName: "Mr. Khan",
    waiterName: "Ravi",
    lines: [
      { name: "Mutton Rogan Josh", quantity: 1, unitPrice: 520, modifiers: [] },
      { name: "Tandoori Roti", quantity: 4, unitPrice: 35, modifiers: [] },
    ],
    payment: "UPI",
    status: "Refunded",
    refundReason: "Mutton was undercooked — full refund",
    refundAgo: 1 * H,
  }),
  buildOrder({
    id: "SRV-9930",
    ago: 1 * D + 5 * H,
    source: "Counter",
    orderType: "Takeaway",
    waiterName: "Suresh",
    lines: [
      { name: "Veg Pulao", quantity: 1, unitPrice: 220, modifiers: [] },
      { name: "Boondi Raita", quantity: 1, unitPrice: 60, modifiers: [] },
    ],
    payment: "Cash",
    status: "Settled",
    prepDuration: 9 * M,
  }),
  buildOrder({
    id: "SRV-9929",
    ago: 2 * D,
    source: "Swiggy",
    orderType: "Delivery",
    customerName: "Aishwarya",
    waiterName: "System",
    lines: [
      { name: "Pasta Alfredo", quantity: 1, unitPrice: 320, modifiers: ["+ Mushrooms"] },
      { name: "Garlic Bread", quantity: 1, unitPrice: 140, modifiers: [] },
      { name: "Tiramisu", quantity: 1, unitPrice: 240, modifiers: [] },
    ],
    payment: "Wallet",
    status: "Settled",
  }),
  buildOrder({
    id: "SRV-9928",
    ago: 2 * D + 2 * H,
    source: "Table 8",
    orderType: "Dine In",
    customerName: "Walk-in",
    waiterName: "Priya",
    lines: [
      { name: "Continental Breakfast", quantity: 2, unitPrice: 360, modifiers: [] },
      { name: "Filter Coffee", quantity: 2, unitPrice: 90, modifiers: [] },
    ],
    payment: "Card",
    status: "Settled",
    prepDuration: 22 * M,
  }),
];

export function formatINR(n: number): string {
  return `₹${n.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function isoDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
