import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Flame,
  Snowflake,
  Wine,
  Ban,
  Volume2,
  VolumeX,
  Undo2,
  ChefHat,
  CheckCircle2,
  Clock,
  Users,
  User,
  ShoppingBag,
  Truck,
  Car,
  LayoutGrid,
  CircleDashed,
} from "lucide-react";
import { useKDS } from "@/context/KDSContext";
import { SEED_KOTS } from "@/lib/seedKOTs";
import type {
  KOT,
  KOTItem,
  OrderType,
  StationId,
} from "@/types";

type StatusFilter = "All" | "Pending" | "Preparing" | "Ready";
type RailId = "EXPO" | StationId;
type DerivedStatus = "Pending" | "Preparing" | "Ready" | "Done";

interface StationDef {
  id: StationId;
  label: string;
  short: string;
  icon: typeof Flame;
  /** active dot / accent color */
  dot: string;
  /** active tab background */
  activeBg: string;
  /** soft surface used for headers/banners */
  soft: string;
  text: string;
  ring: string;
}

/**
 * Physical cooking-line stations. The underlying routing key is the item's
 * `stationId` (Hot/Cold/Bar from Menu Management); these are the operator-facing
 * line identities the kitchen is split into.
 */
const STATIONS: StationDef[] = [
  {
    id: "Hot",
    label: "Tandoor Station",
    short: "Tandoor",
    icon: Flame,
    dot: "bg-orange-500",
    activeBg: "bg-orange-600",
    soft: "bg-orange-50 border-orange-200",
    text: "text-orange-700",
    ring: "ring-orange-200",
  },
  {
    id: "Cold",
    label: "Cold Station",
    short: "Cold",
    icon: Snowflake,
    dot: "bg-sky-500",
    activeBg: "bg-sky-600",
    soft: "bg-sky-50 border-sky-200",
    text: "text-sky-700",
    ring: "ring-sky-200",
  },
  {
    id: "Bar",
    label: "Beverages / Bar",
    short: "Bar",
    icon: Wine,
    dot: "bg-purple-500",
    activeBg: "bg-purple-600",
    soft: "bg-purple-50 border-purple-200",
    text: "text-purple-700",
    ring: "ring-purple-200",
  },
];

const STATION_ORDER: StationId[] = ["Hot", "Cold", "Bar"];
const STATION_BY_ID: Record<StationId, StationDef> = STATIONS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<StationId, StationDef>,
);

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: "All", label: "All" },
  { id: "Pending", label: "Pending" },
  { id: "Preparing", label: "Preparing" },
  { id: "Ready", label: "Ready" },
];

const ORDER_TYPE_ICON: Record<OrderType, typeof ShoppingBag> = {
  "Dine In": Users,
  Takeaway: ShoppingBag,
  Delivery: Truck,
  "Drive Thru": Car,
};

const ORDER_TYPE_TONE: Record<OrderType, string> = {
  "Dine In": "bg-blue-50 text-blue-700 border-blue-200",
  Takeaway: "bg-purple-50 text-purple-700 border-purple-200",
  Delivery: "bg-amber-50 text-amber-700 border-amber-200",
  "Drive Thru": "bg-cyan-50 text-cyan-700 border-cyan-200",
};

function StationGlyph({
  station,
  className = "h-4 w-4",
}: {
  station: StationId;
  className?: string;
}) {
  const def = STATION_BY_ID[station];
  const Icon = def.icon;
  const color =
    station === "Hot"
      ? "text-orange-500"
      : station === "Cold"
        ? "text-sky-500"
        : "text-purple-500";
  return <Icon className={`${className} ${color}`} />;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function useTick(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function deriveStatus(kot: KOT): DerivedStatus {
  const live = kot.items.filter((i) => !i.isVoided);
  if (live.length === 0) return "Done";
  if (live.every((i) => i.status === "Served")) return "Done";
  if (live.every((i) => i.status === "Ready" || i.status === "Served"))
    return "Ready";
  if (live.some((i) => i.status === "Cooking" || i.status === "Ready"))
    return "Preparing";
  return "Pending";
}

/** Live (non-voided) items routed to a given station within a KOT. */
function liveStationItems(kot: KOT, station: StationId): KOTItem[] {
  return kot.items.filter((i) => !i.isVoided && i.stationId === station);
}

function isStationReady(items: KOTItem[]): boolean {
  return (
    items.length > 0 &&
    items.every((i) => i.status === "Ready" || i.status === "Served")
  );
}

function playBeep(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    setTimeout(() => ctx.close(), 600);
  } catch {
    /* noop */
  }
}

export function KDSManagement() {
  const { activeKOTs, addOrder, updateItemStatus, voidItem } = useKDS();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");
  const [rail, setRail] = useState<RailId>("EXPO");
  const [soundOn, setSoundOn] = useState(true);
  const [recallStack, setRecallStack] = useState<KOT[]>([]);
  const [pinging, setPinging] = useState<Set<string>>(new Set());

  // Seed once on first mount if empty.
  useEffect(() => {
    if (activeKOTs.length === 0) {
      SEED_KOTS.forEach(addOrder);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New-order beep
  const prevCountRef = useRef<number>(activeKOTs.length);
  useEffect(() => {
    if (activeKOTs.length > prevCountRef.current && soundOn) {
      playBeep();
    }
    prevCountRef.current = activeKOTs.length;
  }, [activeKOTs.length, soundOn]);

  const isExpo = rail === "EXPO";

  // Per-station active ticket counts (a ticket counts if it has live items at
  // that station that are not all served).
  const stationCounts = useMemo(() => {
    const c: Record<StationId, number> = { Hot: 0, Cold: 0, Bar: 0 };
    for (const kot of activeKOTs) {
      for (const st of STATION_ORDER) {
        const items = liveStationItems(kot, st);
        if (items.length > 0 && !items.every((i) => i.status === "Served")) {
          c[st]++;
        }
      }
    }
    return c;
  }, [activeKOTs]);

  const expoCount = useMemo(
    () => activeKOTs.filter((k) => deriveStatus(k) !== "Done").length,
    [activeKOTs],
  );

  // Build view-model: route items to the selected rail, then derive status on
  // that rail's scope; archive Done tickets.
  const tickets = useMemo(() => {
    return activeKOTs
      .map((kot) => ({
        ...kot,
        items: isExpo
          ? kot.items
          : kot.items.filter((i) => i.stationId === rail),
      }))
      .filter((kot) => kot.items.length > 0)
      .map((kot) => ({ kot, derived: deriveStatus(kot) }))
      .filter(({ derived }) => derived !== "Done")
      .filter(
        ({ derived }) => statusFilter === "All" || derived === statusFilter,
      )
      .sort((a, b) => a.kot.timestamp - b.kot.timestamp);
  }, [activeKOTs, rail, isExpo, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<DerivedStatus, number> = {
      Pending: 0,
      Preparing: 0,
      Ready: 0,
      Done: 0,
    };
    for (const { derived } of activeKOTs
      .map((kot) => ({
        ...kot,
        items: isExpo
          ? kot.items
          : kot.items.filter((i) => i.stationId === rail),
      }))
      .filter((kot) => kot.items.length > 0)
      .map((kot) => ({ derived: deriveStatus(kot) }))) {
      c[derived]++;
    }
    return c;
  }, [activeKOTs, rail, isExpo]);

  // Item click: toggle Served (strikethrough)
  const handleToggleItem = (kotId: string, item: KOTItem) => {
    if (item.isVoided) return;
    updateItemStatus(
      kotId,
      item.id,
      item.status === "Served" ? "Ready" : "Served",
    );
  };

  const handleStartCooking = (kot: KOT) => {
    kot.items.forEach((item) => {
      if (!item.isVoided && item.status === "Pending") {
        updateItemStatus(kot.id, item.id, "Cooking");
      }
    });
  };

  const handleMarkReady = (kot: KOT) => {
    kot.items.forEach((item) => {
      if (
        !item.isVoided &&
        item.status !== "Served" &&
        item.status !== "Ready"
      ) {
        updateItemStatus(kot.id, item.id, "Ready");
      }
    });
    // Trigger ping animation
    setPinging((prev) => new Set(prev).add(kot.id));
    if (soundOn) playBeep();
    window.setTimeout(() => {
      setPinging((prev) => {
        const next = new Set(prev);
        next.delete(kot.id);
        return next;
      });
    }, 1500);
  };

  const handleClearTicket = (kot: KOT) => {
    setRecallStack((prev) =>
      [
        { ...kot, items: kot.items.map((i) => ({ ...i })) },
        ...prev,
      ].slice(0, 5),
    );
    kot.items.forEach((item) => {
      if (!item.isVoided) {
        updateItemStatus(kot.id, item.id, "Served");
      }
    });
  };

  const handleRecall = () => {
    if (recallStack.length === 0) return;
    const [last, ...rest] = recallStack;
    setRecallStack(rest);
    last.items.forEach((item) => {
      if (!item.isVoided) {
        updateItemStatus(last.id, item.id, item.status);
      }
    });
  };

  const handleVoid = (kotId: string, item: KOTItem) => {
    if (item.isVoided) return;
    const reason = window.prompt(`Void "${item.name}" — please enter a reason:`);
    if (reason && reason.trim()) {
      voidItem(kotId, item.id, reason.trim());
    }
  };

  const activeStation = isExpo ? null : STATION_BY_ID[rail];

  return (
    <div className="space-y-4">
      {/* Station rail selector — primary navigation */}
      <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {/* Master Chef / All Stations */}
          <button
            type="button"
            onClick={() => setRail("EXPO")}
            className={`group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
              isExpo
                ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isExpo ? "bg-white/15" : "bg-gray-100"
              }`}
            >
              <LayoutGrid
                className={`h-4 w-4 ${isExpo ? "text-white" : "text-gray-600"}`}
              />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold leading-tight">
                All Stations
              </span>
              <span
                className={`block truncate text-[11px] font-medium ${
                  isExpo ? "text-white/70" : "text-gray-400"
                }`}
              >
                Master Chef · {expoCount} active
              </span>
            </span>
          </button>

          {/* Physical stations */}
          {STATIONS.map((st) => {
            const isActive = rail === st.id;
            const Icon = st.icon;
            const n = stationCounts[st.id];
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setRail(st.id)}
                className={`group relative flex items-center gap-2.5 overflow-hidden rounded-xl border px-3 py-2.5 text-left transition ${
                  isActive
                    ? `${st.activeBg} border-transparent text-white shadow-sm`
                    : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? "bg-white/15" : "bg-gray-100"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      isActive ? "text-white" : st.text
                    }`}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold leading-tight">
                    {st.label}
                  </span>
                  <span
                    className={`block truncate text-[11px] font-medium ${
                      isActive ? "text-white/70" : "text-gray-400"
                    }`}
                  >
                    {n} active {n === 1 ? "ticket" : "tickets"}
                  </span>
                </span>
                {n > 0 && (
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      isActive
                        ? "bg-white/25 text-white"
                        : "bg-gray-900 text-white"
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: status filter + sound + recall */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {/* Status filter pills */}
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1">
          {STATUS_TABS.map((tab) => {
            const isActive = tab.id === statusFilter;
            const count =
              tab.id === "All"
                ? counts.Pending + counts.Preparing + counts.Ready
                : (counts[tab.id as DerivedStatus] ?? 0);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`relative inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                  isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="kds-status-pill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ backgroundColor: "var(--primary-orange)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
                <span
                  className={`relative z-10 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                    isActive ? "bg-white/25 text-white" : "bg-white text-gray-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side: sound + recall */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundOn((s) => !s)}
            title={soundOn ? "Sound on" : "Sound off"}
            aria-label="Toggle sound"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition ${
              soundOn
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
            }`}
          >
            {soundOn ? (
              <Volume2 className="h-4 w-4" />
            ) : (
              <VolumeX className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            onClick={handleRecall}
            disabled={recallStack.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 className="h-3.5 w-3.5" />
            Recall
            {recallStack.length > 0 && (
              <span className="ml-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                {recallStack.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Active rail banner */}
      {activeStation ? (
        <div
          className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 ${activeStation.soft}`}
        >
          <activeStation.icon className={`h-5 w-5 ${activeStation.text}`} />
          <div className="flex-1">
            <div className={`text-sm font-extrabold ${activeStation.text}`}>
              {activeStation.label}
            </div>
            <div className="text-[11px] font-medium text-gray-500">
              Isolated prep line — only items routed to this station are shown.
            </div>
          </div>
          <span
            className={`rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums ${activeStation.text}`}
          >
            {tickets.length} on screen
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5">
          <LayoutGrid className="h-5 w-5 text-gray-700" />
          <div className="flex-1">
            <div className="text-sm font-extrabold text-gray-800">
              Master Chef — Consolidated Manifest
            </div>
            <div className="text-[11px] font-medium text-gray-500">
              Full tickets across every station. Plate up when all stations are
              ready.
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold tabular-nums text-gray-700">
            {tickets.length} on screen
          </span>
        </div>
      )}

      {/* Kitchen Rail */}
      {tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center">
          <ChefHat className="mx-auto h-10 w-10 text-gray-300" />
          <div className="mt-3 text-sm font-semibold text-gray-500">
            {isExpo
              ? statusFilter === "All"
                ? "No active tickets — kitchen is clear."
                : `No tickets in ${statusFilter}.`
              : `No ${activeStation?.label} tickets${
                  statusFilter === "All" ? "" : ` in ${statusFilter}`
                }.`}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {tickets.map(({ kot, derived }) => (
              <TicketCard
                key={kot.id}
                kot={kot}
                derived={derived}
                rail={rail}
                isPinging={pinging.has(kot.id)}
                onToggleItem={handleToggleItem}
                onStartCooking={() => handleStartCooking(kot)}
                onMarkReady={() => handleMarkReady(kot)}
                onClear={() => handleClearTicket(kot)}
                onVoid={handleVoid}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ---------- Ticket Card ---------- */

interface TicketCardProps {
  kot: KOT;
  derived: DerivedStatus;
  rail: RailId;
  isPinging: boolean;
  onToggleItem: (kotId: string, item: KOTItem) => void;
  onStartCooking: () => void;
  onMarkReady: () => void;
  onClear: () => void;
  onVoid: (kotId: string, item: KOTItem) => void;
}

function TicketCard({
  kot,
  derived,
  rail,
  isPinging,
  onToggleItem,
  onStartCooking,
  onMarkReady,
  onClear,
  onVoid,
}: TicketCardProps) {
  const now = useTick(1000);
  const elapsedMs = now - kot.timestamp;
  const elapsedMin = elapsedMs / 60_000;
  const isAging = elapsedMin >= 15;
  const isWarning = elapsedMin >= 10 && elapsedMin < 15;
  const isExpo = rail === "EXPO";

  const orderType: OrderType = kot.orderType ?? "Dine In";
  const TypeIcon = ORDER_TYPE_ICON[orderType];
  const typeTone = ORDER_TYPE_TONE[orderType];

  // Stations present on this ticket (for Master Chef coordination).
  const stationsPresent = useMemo(
    () =>
      STATION_ORDER.filter((st) => liveStationItems(kot, st).length > 0),
    [kot],
  );

  const borderClass =
    derived === "Ready"
      ? "border-emerald-400 ring-2 ring-emerald-200"
      : derived === "Preparing"
        ? "border-amber-400 ring-2 ring-amber-200"
        : isAging
          ? "border-red-400 ring-2 ring-red-200"
          : "border-gray-200";

  const headerStripe =
    derived === "Ready"
      ? "bg-emerald-500"
      : derived === "Preparing"
        ? "bg-amber-400"
        : isExpo
          ? "bg-gray-300"
          : STATION_BY_ID[rail as StationId].dot;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`relative flex flex-col overflow-hidden rounded-xl border-2 bg-white shadow-sm ${borderClass}`}
    >
      {/* Ping ring on Ready */}
      {isPinging && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-ping rounded-xl ring-4 ring-emerald-400/60"
        />
      )}

      {/* Top stripe */}
      <div className={`h-1 w-full ${headerStripe}`} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xl font-extrabold text-gray-900">
              {kot.tableId}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase ${typeTone}`}
            >
              <TypeIcon className="h-3 w-3" />
              {orderType}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {kot.waiterName}
            </span>
            {kot.guestCount && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {kot.guestCount}
              </span>
            )}
            <span className="rounded bg-gray-100 px-1 font-mono text-[10px] text-gray-600">
              #{kot.id.replace("kot-", "")}
            </span>
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-sm font-extrabold tabular-nums ${
            isAging
              ? "bg-red-100 text-red-700 animate-pulse"
              : isWarning
                ? "bg-amber-100 text-amber-800"
                : "bg-gray-100 text-gray-700"
          }`}
          title={isAging ? "Over 15 min — escalate!" : "Time since order"}
        >
          <Clock className="h-3 w-3" />
          {formatElapsed(elapsedMs)}
        </div>
      </div>

      {/* Master Chef: per-station readiness strip for cross-station coordination */}
      {isExpo && stationsPresent.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
          {stationsPresent.map((st) => {
            const def = STATION_BY_ID[st];
            const ready = isStationReady(liveStationItems(kot, st));
            return (
              <span
                key={st}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  ready
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-gray-50 text-gray-500"
                }`}
                title={
                  ready
                    ? `${def.short} ready`
                    : `${def.short} still cooking`
                }
              >
                {ready ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <CircleDashed className="h-3 w-3" />
                )}
                {def.short}
              </span>
            );
          })}
        </div>
      )}

      {/* Items */}
      {isExpo ? (
        <div className="flex-1 space-y-2 px-3 pb-2">
          {STATION_ORDER.filter(
            (st) => kot.items.some((i) => i.stationId === st),
          ).map((st) => {
            const def = STATION_BY_ID[st];
            const items = kot.items.filter((i) => i.stationId === st);
            const ready = isStationReady(liveStationItems(kot, st));
            return (
              <div key={st}>
                <div className="mb-1 flex items-center gap-1.5 px-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${def.dot}`} />
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${def.text}`}
                  >
                    {def.short}
                  </span>
                  {ready && (
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  )}
                  <span className="ml-auto text-[10px] font-semibold text-gray-300">
                    {items.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => onToggleItem(kot.id, item)}
                      onVoid={() => onVoid(kot.id, item)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <ul className="flex-1 space-y-1 px-3 pb-2">
          {kot.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onToggle={() => onToggleItem(kot.id, item)}
              onVoid={() => onVoid(kot.id, item)}
            />
          ))}
        </ul>
      )}

      {/* Footer actions */}
      <div className="border-t border-gray-100 bg-gray-50/60 p-2">
        {derived === "Ready" ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {isExpo ? "Clear · Send to Pass" : "Clear Station"}
          </button>
        ) : derived === "Preparing" ? (
          <button
            type="button"
            onClick={onMarkReady}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Mark Ready
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onStartCooking}
              className="inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Flame className="h-3.5 w-3.5" />
              Start Cooking
            </button>
            <button
              type="button"
              onClick={onMarkReady}
              className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-700 shadow-sm transition hover:bg-emerald-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Ready
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ---------- Item Row ---------- */

function ItemRow({
  item,
  onToggle,
  onVoid,
}: {
  item: KOTItem;
  onToggle: () => void;
  onVoid: () => void;
}) {
  const isDone = item.status === "Served";
  const itemBg = item.isVoided
    ? "bg-red-50/60"
    : isDone
      ? "bg-emerald-50/60"
      : item.status === "Ready"
        ? "bg-emerald-50"
        : item.status === "Cooking"
          ? "bg-amber-50/70"
          : "bg-white hover:bg-gray-50";

  return (
    <li
      className={`group flex items-start gap-2 rounded-md border border-transparent px-2 py-2 transition ${itemBg}`}
    >
      {/* Quantity badge — large, prominent, left */}
      <button
        type="button"
        onClick={onToggle}
        disabled={item.isVoided}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg font-extrabold tabular-nums transition ${
          isDone
            ? "bg-emerald-600 text-white"
            : item.isVoided
              ? "bg-red-100 text-red-400 line-through"
              : "bg-gray-900 text-white hover:bg-orange-600"
        }`}
        title={isDone ? "Mark not done" : "Mark done"}
      >
        {item.quantity}
      </button>

      {/* Item body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <StationGlyph station={item.stationId} className="h-3.5 w-3.5" />
          <button
            type="button"
            onClick={onToggle}
            disabled={item.isVoided}
            className={`text-left text-[15px] font-bold leading-tight ${
              isDone
                ? "text-gray-400 line-through decoration-emerald-500 decoration-[2px]"
                : item.isVoided
                  ? "text-red-700 line-through decoration-red-500 decoration-[3px]"
                  : "text-gray-900"
            }`}
          >
            {item.name}
          </button>
          {item.isVoided && (
            <span className="rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
              Void
            </span>
          )}
        </div>
        {item.modifiers.length > 0 && (
          <div
            className="mt-0.5 pl-0.5 text-[12px] font-bold uppercase leading-snug tracking-wide"
            style={{ color: "var(--primary-orange)" }}
          >
            ↳ {item.modifiers.join(" · ")}
          </div>
        )}
        {item.isVoided && item.voidReason && (
          <div className="mt-0.5 pl-0.5 text-[11px] italic text-red-600">
            Reason: {item.voidReason}
          </div>
        )}
      </div>

      {/* Void icon (subtle, hover-only) */}
      {!item.isVoided && (
        <button
          type="button"
          onClick={onVoid}
          aria-label="Void item"
          title="Void item"
          className="mt-0.5 rounded-full p-1 text-gray-300 opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-600"
        >
          <Ban className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
