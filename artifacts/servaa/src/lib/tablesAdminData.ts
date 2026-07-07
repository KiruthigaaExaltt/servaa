import { SEED_TABLES } from "./fohData";

export type TableType = "Standard" | "Booth" | "Bar Counter" | "High Top" | "Patio";

export interface TableMaster {
  id: string;
  zone: string;
  capacity: number;
  type: TableType;
  isActive: boolean;
  qrCode?: string;
  x: number; // 0-100 % position in blueprint
  y: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string; // tailwind tone keyword
}

export const SEED_ZONES: Zone[] = [
  { id: "z-main", name: "Main Hall", color: "blue" },
  { id: "z-garden", name: "Garden Area", color: "emerald" },
  { id: "z-vip", name: "VIP Section", color: "purple" },
  { id: "z-rooftop", name: "Rooftop", color: "orange" },
];

const ZONE_BY_AREA: Record<string, string> = {
  "Main Hall": "z-main",
  "Garden Area": "z-garden",
  "VIP Section": "z-vip",
};

const TYPE_BY_PREFIX: Record<string, TableType> = {
  T: "Standard",
  V: "Booth",
};

// Deterministic blueprint coordinates per table id
function coordsFor(id: string, zoneId: string): { x: number; y: number } {
  const idx = parseInt(id.replace(/\D/g, ""), 10) || 1;
  // Layout zones in 4 quadrants
  const grid: Record<string, { ox: number; oy: number }> = {
    "z-main": { ox: 8, oy: 10 },
    "z-garden": { ox: 56, oy: 10 },
    "z-vip": { ox: 8, oy: 56 },
    "z-rooftop": { ox: 56, oy: 56 },
  };
  const cell = grid[zoneId] ?? { ox: 8, oy: 10 };
  const col = (idx - 1) % 4;
  const row = Math.floor((idx - 1) / 4) % 2;
  return { x: cell.ox + col * 9, y: cell.oy + row * 16 };
}

export const SEED_TABLE_MASTERS: TableMaster[] = SEED_TABLES.map((t, i) => {
  const zoneId = ZONE_BY_AREA[t.area] ?? "z-main";
  const prefix = t.id.charAt(0);
  const type: TableType =
    t.capacity >= 8
      ? "Booth"
      : t.capacity === 2 && i % 5 === 0
        ? "Bar Counter"
        : (TYPE_BY_PREFIX[prefix] ?? "Standard");
  const { x, y } = coordsFor(t.id, zoneId);
  return {
    id: t.id,
    zone: zoneId,
    capacity: t.capacity,
    type,
    isActive: t.status !== "Maintenance",
    qrCode: `QR${t.id.replace(/\D/g, "").padStart(3, "0")}`,
    x,
    y,
  };
}).concat([
  { id: "R-1", zone: "z-rooftop", capacity: 4, type: "Patio", isActive: true, qrCode: "QR101", x: 56, y: 56 },
  { id: "R-2", zone: "z-rooftop", capacity: 4, type: "Patio", isActive: true, qrCode: "QR102", x: 65, y: 56 },
  { id: "R-3", zone: "z-rooftop", capacity: 6, type: "High Top", isActive: true, qrCode: "QR103", x: 74, y: 56 },
  { id: "R-4", zone: "z-rooftop", capacity: 2, type: "Bar Counter", isActive: false, qrCode: "QR104", x: 56, y: 72 },
]);

export const ZONE_TONE: Record<string, { bg: string; ring: string; text: string; fill: string }> = {
  blue: {
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    text: "text-blue-700",
    fill: "fill-blue-200/40 stroke-blue-300",
  },
  emerald: {
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    text: "text-emerald-700",
    fill: "fill-emerald-200/40 stroke-emerald-300",
  },
  purple: {
    bg: "bg-purple-50",
    ring: "ring-purple-200",
    text: "text-purple-700",
    fill: "fill-purple-200/40 stroke-purple-300",
  },
  orange: {
    bg: "bg-orange-50",
    ring: "ring-orange-200",
    text: "text-orange-700",
    fill: "fill-orange-200/40 stroke-orange-300",
  },
  pink: {
    bg: "bg-pink-50",
    ring: "ring-pink-200",
    text: "text-pink-700",
    fill: "fill-pink-200/40 stroke-pink-300",
  },
  amber: {
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    text: "text-amber-700",
    fill: "fill-amber-200/40 stroke-amber-300",
  },
  cyan: {
    bg: "bg-cyan-50",
    ring: "ring-cyan-200",
    text: "text-cyan-700",
    fill: "fill-cyan-200/40 stroke-cyan-300",
  },
};

export const ZONE_COLOR_OPTIONS = [
  "blue",
  "emerald",
  "purple",
  "orange",
  "pink",
  "amber",
  "cyan",
];
