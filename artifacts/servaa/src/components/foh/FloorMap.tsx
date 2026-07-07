import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Brush,
  Users,
  Clock,
  Trees,
  Home,
  Crown,
  Wrench,
  CalendarClock,
  CheckSquare,
  Square,
  Merge,
  Split,
  Receipt,
} from "lucide-react";
import { useFOH } from "@/context/FOHContext";
import { useKDS } from "@/context/KDSContext";
import { useToast } from "@/hooks/use-toast";
import { SettleModal } from "@/components/foh/SettleModal";
import { useSettlement } from "@/hooks/useSettlement";
import type { FloorTable, TableArea, TableStatus } from "@/lib/fohData";
import type { KOT } from "@/types";

interface FloorMapProps {
  onOpenOrdering: () => void;
}

const STATUS_META: Record<
  TableStatus,
  { label: string; dot: string; color: string }
> = {
  Occupied: { label: "Occupied", dot: "bg-orange-500", color: "var(--primary-orange)" },
  Vacant: { label: "Vacant", dot: "bg-white ring-1 ring-gray-300", color: "#ffffff" },
  Reserved: { label: "Reserved", dot: "bg-blue-500", color: "#3b82f6" },
  Cleaning: { label: "Cleaning", dot: "bg-gray-400", color: "#9ca3af" },
  Maintenance: { label: "Maintenance", dot: "bg-red-500", color: "#ef4444" },
  "Waiting for Settlement": {
    label: "Awaiting Payment",
    dot: "bg-orange-500 ring-2 ring-orange-300",
    color: "var(--primary-orange)",
  },
};

const AREA_ORDER: TableArea[] = ["Main Hall", "Garden Area", "VIP Section"];

const AREA_ICON: Record<TableArea, typeof Home> = {
  "Main Hall": Home,
  "Garden Area": Trees,
  "VIP Section": Crown,
};

export function FloorMap({ onOpenOrdering }: FloorMapProps) {
  const { tables, selectTable, setTableStatus, pendingBills } = useFOH();
  const { kotsByTable } = useKDS();
  const { toast } = useToast();
  const { finalizeSettlement, isSettling } = useSettlement();
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [settleTarget, setSettleTarget] = useState<string | null>(null);

  // Reset selection when toggling off
  useEffect(() => {
    if (!multiSelect) setSelected(new Set());
  }, [multiSelect]);

  // Derive effective tables — if KDS has active KOTs for a table, treat as Occupied
  const effectiveTables: FloorTable[] = useMemo(() => {
    return tables.map((t) => {
      const kots = (kotsByTable[t.id] ?? []) as KOT[];
      const hasActive = kots.some((k) =>
        k.items.some((i) => i.status !== "Served" && i.status !== "Voided"),
      );
      if (!hasActive) return t;
      // Only infer occupancy for tables that are otherwise idle. Explicit
      // operational states (Occupied, Waiting for Settlement, Cleaning,
      // Maintenance) must never be silently overridden by KDS activity.
      if (t.status !== "Vacant" && t.status !== "Reserved") return t;
      // Override Vacant/Reserved → Occupied with KOT-derived metadata
      const earliest = Math.min(...kots.map((k) => k.timestamp));
      const firstKot = kots[0];
      return {
        ...t,
        status: "Occupied" as TableStatus,
        pax: t.pax ?? firstKot.guestCount,
        waiterName: t.waiterName ?? firstKot.waiterName,
        customerName: t.customerName ?? firstKot.customerName ?? "Walk-in",
        occupiedSince: t.occupiedSince ?? earliest,
      };
    });
  }, [tables, kotsByTable]);

  const counts = useMemo(() => {
    const c: Record<TableStatus, number> = {
      Occupied: 0,
      Vacant: 0,
      Reserved: 0,
      Cleaning: 0,
      Maintenance: 0,
      "Waiting for Settlement": 0,
    };
    for (const t of effectiveTables) c[t.status]++;
    return c;
  }, [effectiveTables]);

  const grouped: Record<TableArea, FloorTable[]> = {
    "Main Hall": [],
    "Garden Area": [],
    "VIP Section": [],
  };
  for (const t of effectiveTables) grouped[t.area].push(t);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleTileClick = (t: FloorTable) => {
    if (multiSelect) {
      toggleSelect(t.id);
      return;
    }
    if (t.status === "Cleaning") {
      setTableStatus(t.id, "Vacant");
      return;
    }
    if (t.status === "Maintenance") {
      toast({
        title: `${t.id} is under maintenance`,
        description: t.maintenanceNote ?? "Out of service.",
        variant: "destructive",
      });
      return;
    }
    if (t.status === "Waiting for Settlement") {
      setSettleTarget(t.id);
      return;
    }
    selectTable(t.id);
    onOpenOrdering();
  };

  const settlePending = settleTarget ? pendingBills[settleTarget] : undefined;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="font-semibold text-gray-900">
            {effectiveTables.length}
          </span>
          tables across {AREA_ORDER.length} zones
        </div>
        <div className="flex items-center gap-2">
          {multiSelect && selected.size >= 2 && (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: `Merged ${selected.size} tables`,
                  description: `${[...selected].join(" + ")} grouped for combined service.`,
                });
                setSelected(new Set());
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
            >
              <Merge className="h-3.5 w-3.5" /> Merge ({selected.size})
            </button>
          )}
          {multiSelect && selected.size === 1 && (
            <button
              type="button"
              onClick={() => {
                toast({
                  title: `Split ${[...selected][0]}`,
                  description: "Table prepared for split billing.",
                });
                setSelected(new Set());
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-200"
            >
              <Split className="h-3.5 w-3.5" /> Split
            </button>
          )}
          <button
            type="button"
            onClick={() => setMultiSelect((m) => !m)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              multiSelect
                ? "border-transparent text-white shadow"
                : "border-gray-200 bg-white text-gray-700 hover:border-orange-300"
            }`}
            style={
              multiSelect
                ? { backgroundColor: "var(--primary-orange)" }
                : undefined
            }
          >
            {multiSelect ? (
              <CheckSquare className="h-3.5 w-3.5" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            Multi-select
          </button>
        </div>
      </div>

      {/* Zones with blueprint background */}
      <div className="space-y-4">
        {AREA_ORDER.map((area) => {
          const Icon = AREA_ICON[area];
          const items = grouped[area];
          const isVip = area === "VIP Section";
          return (
            <section
              key={area}
              className={`rounded-2xl border p-5 shadow-sm ${
                isVip
                  ? "border-amber-300 bg-gradient-to-br from-amber-50/60 to-white"
                  : "border-gray-200 bg-white"
              }`}
              style={{
                backgroundImage: isVip
                  ? "linear-gradient(rgba(251,191,36,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,0.10) 1px, transparent 1px)"
                  : "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
                backgroundSize: "28px 28px",
              }}
            >
              <header className="mb-4 flex items-center gap-2">
                <Icon
                  className={`h-5 w-5 ${
                    isVip ? "text-amber-600" : "text-gray-700"
                  }`}
                />
                <h2 className="text-lg font-semibold text-gray-900">{area}</h2>
                {isVip && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                    VIP
                  </span>
                )}
                <span className="ml-auto text-xs text-gray-500">
                  {items.length} tables
                </span>
              </header>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {items.map((t) => (
                  <TableTile
                    key={t.id}
                    table={t}
                    selected={selected.has(t.id)}
                    multiSelect={multiSelect}
                    pendingTotal={pendingBills[t.id]?.total}
                    onClick={() => handleTileClick(t)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Legend bar (bottom, sticky-ish) */}
      <div className="sticky bottom-2 z-10 rounded-xl border border-gray-200 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Legend
          </span>
          {(Object.keys(STATUS_META) as TableStatus[]).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[s].dot}`} />
              {STATUS_META[s].label}
              <span className="text-gray-400">· {counts[s]}</span>
            </span>
          ))}
        </div>
      </div>

      <SettleModal
        open={settleTarget !== null && settlePending !== undefined}
        total={settlePending?.total ?? 0}
        title={`Settle ${settleTarget ?? ""}`}
        subtitle={
          settlePending
            ? `${settlePending.meta.customerName || "Guest"} · ${settlePending.lines.length} items`
            : undefined
        }
        onClose={() => setSettleTarget(null)}
        isSubmitting={settleTarget ? isSettling(settleTarget) : false}
        onPaid={async (method, tendered, change, feedback) => {
          if (!settleTarget || !settlePending) return;
          const tid = settleTarget;
          const bill = settlePending;
          const result = await finalizeSettlement({
            tableId: tid,
            payment: {
              method,
              amountTendered: method === "Cash" ? tendered : undefined,
              changeReturned: method === "Cash" ? change : undefined,
            },
            feedback,
          });
          if (result.ok) {
            setSettleTarget(null);
            toast({
              title: `Settled · ${tid}`,
              description: `₹${bill.total.toLocaleString("en-IN")} via ${method} · ${result.invoiceNumber}`,
            });
          } else {
            toast({
              title: "Settlement failed",
              description: result.error,
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}

function TableTile({
  table,
  selected,
  multiSelect,
  pendingTotal,
  onClick,
}: {
  table: FloorTable;
  selected: boolean;
  multiSelect: boolean;
  pendingTotal?: number;
  onClick: () => void;
}) {
  // Tick to refresh the Occupied timer
  const [, force] = useState(0);
  useEffect(() => {
    if (table.status !== "Occupied") return;
    const id = window.setInterval(() => force((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, [table.status]);

  const dot = STATUS_META[table.status].dot;

  const baseClasses =
    "relative overflow-hidden rounded-xl p-3 text-left shadow-sm transition";
  const selectionRing = selected
    ? "ring-2 ring-orange-500 ring-offset-2"
    : "";

  let body: React.ReactNode;
  let bgClasses = "";

  if (table.status === "Occupied") {
    const minutes = table.occupiedSince
      ? Math.max(0, Math.floor((Date.now() - table.occupiedSince) / 60_000))
      : 0;
    bgClasses = "text-white";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold">{table.id}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
            Occupied
          </span>
        </div>
        <div className="mt-1 truncate text-xs font-medium opacity-95">
          {table.customerName ?? "Guest"}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] font-medium">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {table.pax ?? "—"}/{table.capacity}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {minutes}m
          </span>
        </div>
        <div className="mt-1 truncate text-[11px] opacity-90">
          {table.waiterName ?? "Unassigned"}
        </div>
      </>
    );
  } else if (table.status === "Reserved") {
    bgClasses = "border border-blue-200 bg-blue-50";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold text-blue-900">
            {table.id}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
            Reserved
          </span>
        </div>
        <div className="mt-1 truncate text-xs font-semibold text-blue-900">
          {table.reservationName ?? "Booked"}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700">
          <CalendarClock className="h-3 w-3" />
          {table.reservationTime ?? "—"}
        </div>
        <div className="mt-1 text-[11px] text-blue-600">
          {table.capacity} seats
        </div>
      </>
    );
  } else if (table.status === "Cleaning") {
    bgClasses = "border border-gray-300 bg-gray-100";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold text-gray-700">
            {table.id}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Cleaning
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-gray-600">
          <Brush className="h-5 w-5" />
          <span className="text-xs font-medium">Tap when done</span>
        </div>
        <div className="mt-1 text-[11px] text-gray-500">
          {table.capacity} seats
        </div>
      </>
    );
  } else if (table.status === "Waiting for Settlement") {
    bgClasses = "animate-pulse-settle text-white";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold">{table.id}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90">
            Awaiting Pay
          </span>
        </div>
        <div className="mt-1 truncate text-xs font-medium opacity-95">
          {table.customerName ?? "Guest"}
        </div>
        <div className="mt-2 inline-flex items-center gap-1 text-sm font-extrabold">
          <Receipt className="h-3.5 w-3.5" />
          ₹{(pendingTotal ?? 0).toLocaleString("en-IN")}
        </div>
        <div className="mt-1 text-[11px] font-medium opacity-90">
          Tap to settle
        </div>
      </>
    );
  } else if (table.status === "Maintenance") {
    bgClasses = "border-2 border-dashed border-red-300 bg-red-50";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold text-red-900">{table.id}</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600">
            Out
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2 text-red-700">
          <Wrench className="h-5 w-5" />
          <span className="text-xs font-medium">Maintenance</span>
        </div>
        <div className="mt-1 truncate text-[11px] italic text-red-600">
          {table.maintenanceNote ?? "Service required"}
        </div>
      </>
    );
  } else {
    bgClasses = "border border-gray-200 bg-white hover:border-emerald-400";
    body = (
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-extrabold text-gray-900">
            {table.id}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
            Vacant
          </span>
        </div>
        <div className="mt-3 text-xs font-medium text-gray-700">Available</div>
        <div className="mt-1 text-[11px] text-gray-500">
          {table.capacity} seats
        </div>
      </>
    );
  }

  return (
    <motion.button
      layout
      whileHover={multiSelect ? undefined : { y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={
        table.status === "Occupied" ||
        table.status === "Waiting for Settlement"
          ? { backgroundColor: "var(--primary-orange)" }
          : undefined
      }
      className={`${baseClasses} ${bgClasses} ${selectionRing}`}
    >
      {/* Status corner dot */}
      <span
        className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full ${dot}`}
        aria-hidden
      />
      {/* Multi-select corner */}
      {multiSelect && (
        <span className="absolute left-1.5 top-1.5">
          {selected ? (
            <CheckSquare
              className={`h-3.5 w-3.5 ${
                table.status === "Occupied" ? "text-white" : "text-orange-600"
              }`}
            />
          ) : (
            <Square
              className={`h-3.5 w-3.5 ${
                table.status === "Occupied" ? "text-white/80" : "text-gray-400"
              }`}
            />
          )}
        </span>
      )}
      {body}
    </motion.button>
  );
}
