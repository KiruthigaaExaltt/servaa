import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bike,
  Truck,
  Phone,
  MessageCircle,
  Clock,
  Inbox,
  Flame,
  PackageCheck,
  CheckCircle2,
  X,
  Plus,
  MapPin,
  Star,
  AlertTriangle,
  Power,
  Moon,
  Users,
  Trophy,
} from "lucide-react";
import {
  SEED_AGGREGATORS,
  SEED_DELIVERIES,
  SEED_RIDERS,
  RIDER_TONE,
  SOURCE_DOT,
  SOURCE_TONE,
  STATUS_TONE,
  elapsedSince,
  formatINR,
  type AggregatorState,
  type DeliveryOrder,
  type DeliverySource,
  type DeliveryStatus,
  type Rider,
  type RiderStatus,
} from "@/lib/deliveryData";
import { useCollectionState } from "@/lib/collectionState";

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

const COLUMNS: { id: DeliveryStatus; label: string; icon: typeof Inbox; tone: string }[] = [
  { id: "Incoming", label: "Incoming", icon: Inbox, tone: "border-t-blue-400" },
  {
    id: "Preparing",
    label: "Preparing",
    icon: Flame,
    tone: "border-t-amber-400",
  },
  {
    id: "Ready",
    label: "Ready for Pickup",
    icon: PackageCheck,
    tone: "border-t-emerald-400",
  },
  { id: "Out", label: "Out for Delivery", icon: Bike, tone: "border-t-purple-400" },
];

export function DeliveryManagement() {
  const [orders, setOrders] = useCollectionState<DeliveryOrder[]>("delivery_orders", SEED_DELIVERIES);
  const [riders, setRiders] = useCollectionState<Rider[]>("delivery_riders", SEED_RIDERS);
  const [aggs, setAggs] = useCollectionState<AggregatorState[]>("delivery_aggregators", SEED_AGGREGATORS);
  const [, setTick] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [assigning, setAssigning] = useState<DeliveryOrder | null>(null);
  const [active, setActive] = useState<DeliveryOrder | null>(null);
  const [snoozeFor, setSnoozeFor] = useState<DeliverySource | null>(null);
  const dragOrderId = useRef<string | null>(null);
  const dragOverColumn = useRef<DeliveryStatus | null>(null);
  const [dragHover, setDragHover] = useState<DeliveryStatus | null>(null);
  const [dragRiderHover, setDragRiderHover] = useState<string | null>(null);

  // Tick clock for elapsed times
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  /* ---------- KPIs ---------- */
  const kpis = useMemo(() => {
    const active = orders.filter((o) => o.status === "Out").length;
    const delivered = orders.filter((o) => o.status === "Delivered");
    const avgMin =
      delivered.length === 0
        ? 0
        : Math.round(
            delivered.reduce(
              (s, o) =>
                s +
                ((o.deliveredAt ?? 0) - (o.readyAt ?? o.receivedAt)) /
                  60000,
              0,
            ) / delivered.length,
          );
    const todayDelivered = delivered.length;
    const sourceCount: Record<DeliverySource, number> = {
      Direct: 0,
      Zomato: 0,
      Swiggy: 0,
    };
    orders.forEach((o) => sourceCount[o.source]++);
    // Top rider today
    const tally = new Map<string, number>();
    delivered.forEach((o) => {
      if (o.riderId) tally.set(o.riderId, (tally.get(o.riderId) ?? 0) + 1);
    });
    let topRider: Rider | undefined;
    let topCount = 0;
    for (const [rid, c] of tally) {
      if (c > topCount) {
        topCount = c;
        topRider = riders.find((r) => r.id === rid);
      }
    }
    if (!topRider) {
      topRider = [...riders].sort(
        (a, b) => b.todayDeliveries - a.todayDeliveries,
      )[0];
      topCount = topRider?.todayDeliveries ?? 0;
    }
    return { active, avgMin, todayDelivered, sourceCount, topRider, topCount };
  }, [orders, riders]);

  /* ---------- Helpers ---------- */
  const setOrderStatus = (id: string, status: DeliveryStatus) => {
    setOrders((arr) =>
      arr.map((o) => {
        if (o.id !== id) return o;
        const next: DeliveryOrder = { ...o, status };
        const t = Date.now();
        if (status === "Ready" && !o.readyAt) next.readyAt = t;
        if (status === "Out" && !o.pickedAt) next.pickedAt = t;
        if (status === "Delivered") next.deliveredAt = t;
        return next;
      }),
    );
    if (status === "Out") {
      pushToast(`${id} dispatched Â· synced to FOH/KDS`, "info");
    } else if (status === "Delivered") {
      const o = orders.find((x) => x.id === id);
      if (o?.riderId) {
        setRiders((rs) =>
          rs.map((r) =>
            r.id === o.riderId
              ? {
                  ...r,
                  status: "Idle",
                  todayDeliveries: r.todayDeliveries + 1,
                }
              : r,
          ),
        );
      }
      pushToast(`${id} delivered`);
    }
  };

  const assignRider = (orderId: string, riderId: string) => {
    const rider = riders.find((r) => r.id === riderId);
    const order = orders.find((o) => o.id === orderId);
    if (!rider || !order) return;
    if (rider.status === "Off-duty") {
      pushToast(`${rider.name} is off-duty`, "warn");
      return;
    }
    setOrders((arr) =>
      arr.map((o) =>
        o.id === orderId
          ? {
              ...o,
              riderId,
              status: o.status === "Ready" ? "Out" : o.status,
              pickedAt: o.status === "Ready" ? Date.now() : o.pickedAt,
            }
          : o,
      ),
    );
    setRiders((rs) =>
      rs.map((r) => (r.id === riderId ? { ...r, status: "Busy" } : r)),
    );
    pushToast(`${rider.name} assigned to ${orderId}`);
    setAssigning(null);
  };

  const toggleSync = (source: DeliverySource) => {
    setAggs((arr) =>
      arr.map((a) => (a.source === source ? { ...a, sync: !a.sync } : a)),
    );
    const a = aggs.find((x) => x.source === source);
    pushToast(`${source} sync ${a?.sync ? "OFF" : "ON"}`, "info");
  };

  const snoozeAggregator = (source: DeliverySource, minutes: number) => {
    const until = Date.now() + minutes * 60 * 1000;
    setAggs((arr) =>
      arr.map((a) =>
        a.source === source ? { ...a, snoozeUntil: until } : a,
      ),
    );
    pushToast(`${source} snoozed for ${minutes}m`, "info");
    setSnoozeFor(null);
  };

  const wakeAggregator = (source: DeliverySource) => {
    setAggs((arr) =>
      arr.map((a) =>
        a.source === source ? { ...a, snoozeUntil: undefined } : a,
      ),
    );
    pushToast(`${source} resumed`);
  };

  const toggleRiderStatus = (id: string) => {
    setRiders((rs) =>
      rs.map((r) =>
        r.id === id
          ? {
              ...r,
              status:
                r.status === "Off-duty"
                  ? "Idle"
                  : r.status === "Idle"
                    ? "Off-duty"
                    : r.status,
            }
          : r,
      ),
    );
  };

  /* ---------- Drag & Drop ---------- */
  const onCardDragStart = (id: string) => {
    dragOrderId.current = id;
  };
  const onColumnDragOver = (e: React.DragEvent, col: DeliveryStatus) => {
    e.preventDefault();
    if (dragOverColumn.current !== col) {
      dragOverColumn.current = col;
      setDragHover(col);
    }
  };
  const onColumnDrop = (col: DeliveryStatus) => {
    const id = dragOrderId.current;
    dragOrderId.current = null;
    dragOverColumn.current = null;
    setDragHover(null);
    if (!id) return;
    setOrderStatus(id, col);
  };
  const onRiderDragOver = (e: React.DragEvent, riderId: string) => {
    e.preventDefault();
    setDragRiderHover(riderId);
  };
  const onRiderDrop = (riderId: string) => {
    const id = dragOrderId.current;
    dragOrderId.current = null;
    setDragRiderHover(null);
    if (!id) return;
    assignRider(id, riderId);
  };

  /* ---------- Counts ---------- */
  const byColumn = useMemo(() => {
    const map: Record<DeliveryStatus, DeliveryOrder[]> = {
      Incoming: [],
      Preparing: [],
      Ready: [],
      Out: [],
      Delivered: [],
    };
    for (const o of orders) map[o.status].push(o);
    Object.values(map).forEach((arr) =>
      arr.sort((a, b) => a.receivedAt - b.receivedAt),
    );
    return map;
  }, [orders]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Bike}
          label="Active Deliveries"
          value={kpis.active.toString()}
          accent="text-purple-600"
        />
        <KpiCard
          icon={Clock}
          label="Avg Delivery Time"
          value={`${kpis.avgMin || "â€”"}${kpis.avgMin ? " min" : ""}`}
          accent="text-emerald-600"
          sub={`${kpis.todayDelivered} delivered today`}
        />
        <SourceSplitCard counts={kpis.sourceCount} />
        <KpiCard
          icon={Trophy}
          label="Top Rider"
          value={kpis.topRider?.name ?? "â€”"}
          accent="text-[color:var(--primary-orange)]"
          sub={`${kpis.topCount} deliveries Â· â­ ${kpis.topRider?.rating ?? "â€”"}`}
        />
      </div>

      {/* Aggregator bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Aggregator Sync
        </div>
        {aggs.map((a) => {
          const snoozed =
            a.snoozeUntil && a.snoozeUntil > Date.now() ? a.snoozeUntil : null;
          return (
            <div
              key={a.source}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
                snoozed
                  ? "border-amber-200 bg-amber-50"
                  : a.sync
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-gray-200 bg-gray-50"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${SOURCE_DOT[a.source]}`}
              />
              <span className="text-sm font-bold text-gray-900">
                {a.source}
              </span>
              <button
                type="button"
                onClick={() => toggleSync(a.source)}
                aria-pressed={a.sync}
                className={`relative h-5 w-9 rounded-full transition ${
                  a.sync ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                    a.sync ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
              {snoozed ? (
                <button
                  type="button"
                  onClick={() => wakeAggregator(a.source)}
                  className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800 hover:bg-amber-200"
                >
                  <Moon className="h-3 w-3" />
                  Snoozed Â· Wake
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSnoozeFor(a.source)}
                  className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                >
                  <Moon className="h-3 w-3" />
                  Snooze
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Main: Kanban + Riders */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const list = byColumn[col.id];
            const Icon = col.icon;
            const isHover = dragHover === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => onColumnDragOver(e, col.id)}
                onDrop={() => onColumnDrop(col.id)}
                onDragLeave={() => {
                  if (dragOverColumn.current === col.id) {
                    dragOverColumn.current = null;
                    setDragHover(null);
                  }
                }}
                className={`flex flex-col rounded-2xl border-t-4 bg-gray-50/70 ${col.tone} ${
                  isHover ? "ring-2 ring-orange-300" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-bold text-gray-900">
                      {col.label}
                    </span>
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-gray-600 ring-1 ring-gray-200">
                    {list.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-2 pb-2 min-h-[200px]">
                  {list.length === 0 && (
                    <div className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-[11px] text-gray-400">
                      No orders
                    </div>
                  )}
                  {list.map((o) => {
                    const rider = riders.find((r) => r.id === o.riderId);
                    return (
                      <DeliveryCard
                        key={o.id}
                        order={o}
                        rider={rider}
                        onDragStart={() => onCardDragStart(o.id)}
                        onClick={() => setActive(o)}
                        onAssign={() => setAssigning(o)}
                        onAdvance={() => {
                          const next: DeliveryStatus =
                            o.status === "Incoming"
                              ? "Preparing"
                              : o.status === "Preparing"
                                ? "Ready"
                                : o.status === "Ready"
                                  ? "Out"
                                  : "Delivered";
                          if (next === "Out" && !o.riderId) {
                            setAssigning(o);
                            return;
                          }
                          setOrderStatus(o.id, next);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Rider Panel */}
        <RiderPanel
          riders={riders}
          dragRiderHover={dragRiderHover}
          onDragOver={onRiderDragOver}
          onDrop={onRiderDrop}
          onToggleStatus={toggleRiderStatus}
          activeOrders={byColumn.Out}
        />
      </div>

      {/* Modals & drawers */}
      <AnimatePresence>
        {assigning && (
          <AssignRiderModal
            order={assigning}
            riders={riders}
            onClose={() => setAssigning(null)}
            onAssign={(rid) => assignRider(assigning.id, rid)}
          />
        )}
        {active && (
          <OrderDrawer
            order={active}
            rider={riders.find((r) => r.id === active.riderId)}
            onClose={() => setActive(null)}
            onAssign={() => {
              setActive(null);
              setAssigning(active);
            }}
            onSetStatus={(s) => {
              setOrderStatus(active.id, s);
              setActive(null);
            }}
          />
        )}
        {snoozeFor && (
          <SnoozeModal
            source={snoozeFor}
            onClose={() => setSnoozeFor(null)}
            onPick={(m) => snoozeAggregator(snoozeFor, m)}
          />
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[80] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
                t.tone === "success"
                  ? "bg-emerald-600"
                  : t.tone === "warn"
                    ? "bg-red-600"
                    : "bg-gray-900"
              }`}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- KPI ---------- */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-gray-900",
}: {
  icon: typeof Inbox;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className={`mt-1 truncate text-xl font-extrabold ${accent}`}>
        {value}
      </div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

function SourceSplitCard({
  counts,
}: {
  counts: Record<DeliverySource, number>;
}) {
  const total = counts.Direct + counts.Zomato + counts.Swiggy || 1;
  const pct = (n: number) => Math.round((n / total) * 100);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>Source Split</span>
        <Users className="h-4 w-4 text-gray-300" />
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-gray-100">
        <div
          className={SOURCE_DOT.Direct}
          style={{ width: `${pct(counts.Direct)}%` }}
        />
        <div
          className={SOURCE_DOT.Zomato}
          style={{ width: `${pct(counts.Zomato)}%` }}
        />
        <div
          className={SOURCE_DOT.Swiggy}
          style={{ width: `${pct(counts.Swiggy)}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px]">
        {(["Direct", "Zomato", "Swiggy"] as DeliverySource[]).map((s) => (
          <div key={s} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${SOURCE_DOT[s]}`} />
            <span className="font-bold text-gray-700">{counts[s]}</span>
            <span className="text-gray-400">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Card ---------- */
function DeliveryCard({
  order,
  rider,
  onDragStart,
  onClick,
  onAssign,
  onAdvance,
}: {
  order: DeliveryOrder;
  rider?: Rider;
  onDragStart: () => void;
  onClick: () => void;
  onAssign: () => void;
  onAdvance: () => void;
}) {
  const advanceLabel: Record<DeliveryStatus, string> = {
    Incoming: "Accept",
    Preparing: "Mark Ready",
    Ready: "Dispatch",
    Out: "Delivered",
    Delivered: "â€”",
  };
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="group cursor-grab overflow-hidden rounded-xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-orange-200 hover:shadow active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${SOURCE_TONE[order.source]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[order.source]}`} />
              {order.source}
            </span>
            <span className="font-mono text-[11px] font-bold text-gray-900">
              {order.id}
            </span>
          </div>
          <div className="mt-1 text-sm font-bold text-gray-900 truncate">
            {order.customerName}
          </div>
          <div className="mt-0.5 flex items-start gap-1 text-[11px] text-gray-500">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span className="line-clamp-2">{order.address}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-extrabold tabular-nums text-gray-900">
            {formatINR(order.total)}
          </div>
          <div className="text-[10px] text-gray-400">
            {order.items.reduce((s, i) => s + i.qty, 0)} items
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {elapsedSince(order.receivedAt)}
        </span>
        {rider && (
          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-200">
            <Bike className="h-3 w-3" />
            {rider.name.split(" ")[0]}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1">
        <a
          href={`tel:${order.customerPhone}`}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <Phone className="h-3 w-3" />
          Call
        </a>
        <a
          href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${order.customerName}, regarding order ${order.id}: ${order.address}`)}`}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-bold text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
        >
          <MessageCircle className="h-3 w-3" />
          WhatsApp
        </a>
      </div>

      <div className="mt-1.5 flex items-center gap-1">
        {order.status === "Ready" && !rider && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAssign();
            }}
            className="flex-1 rounded-md bg-purple-600 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-purple-700"
          >
            Assign Rider
          </button>
        )}
        {order.status !== "Delivered" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAdvance();
            }}
            className="flex-1 rounded-md px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            {advanceLabel[order.status]}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Rider Panel ---------- */
function RiderPanel({
  riders,
  dragRiderHover,
  onDragOver,
  onDrop,
  onToggleStatus,
  activeOrders,
}: {
  riders: Rider[];
  dragRiderHover: string | null;
  onDragOver: (e: React.DragEvent, riderId: string) => void;
  onDrop: (riderId: string) => void;
  onToggleStatus: (id: string) => void;
  activeOrders: DeliveryOrder[];
}) {
  const counts: Record<RiderStatus, number> = {
    Idle: 0,
    Busy: 0,
    "Off-duty": 0,
  };
  riders.forEach((r) => counts[r.status]++);
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Bike className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Riders</h3>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500 hover:border-orange-300 hover:text-orange-700"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px]">
          <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 font-bold text-emerald-700 ring-1 ring-emerald-200">
            {counts.Idle} idle
          </span>
          <span className="rounded-full bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700 ring-1 ring-purple-200">
            {counts.Busy} busy
          </span>
          <span className="rounded-full bg-gray-100 px-1.5 py-0.5 font-bold text-gray-500 ring-1 ring-gray-200">
            {counts["Off-duty"]} off
          </span>
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Drag a Ready order onto an Idle rider to dispatch.
        </p>
      </div>
      <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
        {riders.map((r) => {
          const assigned = activeOrders.find((o) => o.riderId === r.id);
          const droppable = r.status !== "Off-duty";
          const isHover = dragRiderHover === r.id && droppable;
          return (
            <li
              key={r.id}
              onDragOver={(e) => droppable && onDragOver(e, r.id)}
              onDrop={() => droppable && onDrop(r.id)}
              className={`p-3 transition ${
                isHover ? "bg-orange-50 ring-2 ring-orange-300" : ""
              } ${r.status === "Off-duty" ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-400 text-sm font-extrabold text-white">
                    {r.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900">
                      {r.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                      <span className="font-bold">{r.rating}</span>
                      <span>Â·</span>
                      <span>{r.todayDeliveries} today</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      {r.vehicle}
                    </div>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${RIDER_TONE[r.status]}`}
                >
                  {r.status}
                </span>
              </div>
              {assigned && (
                <div className="mt-2 rounded-md bg-purple-50 px-2 py-1 text-[11px] font-bold text-purple-700 ring-1 ring-purple-200">
                  â†’ {assigned.id}
                </div>
              )}
              <div className="mt-2 flex items-center gap-1">
                <a
                  href={`tel:${r.phone}`}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Phone className="h-3 w-3" />
                  Call
                </a>
                <button
                  type="button"
                  onClick={() => onToggleStatus(r.id)}
                  className={`inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-[11px] font-bold ${
                    r.status === "Off-duty"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
                  }`}
                >
                  <Power className="h-3 w-3" />
                  {r.status === "Off-duty" ? "Clock In" : "Clock Out"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------- Assign Rider Modal ---------- */
function AssignRiderModal({
  order,
  riders,
  onClose,
  onAssign,
}: {
  order: DeliveryOrder;
  riders: Rider[];
  onClose: () => void;
  onAssign: (riderId: string) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const idle = riders.filter((r) => r.status === "Idle");
  const busy = riders.filter((r) => r.status === "Busy");
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                Assign Rider
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {order.id} Â· {order.customerName}
              </h3>
              <div className="text-[11px] text-gray-500">{order.address}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>
          <div className="max-h-[60vh] overflow-y-auto">
            {idle.length > 0 && (
              <Section title={`Available (${idle.length})`}>
                {idle.map((r) => (
                  <RiderRow key={r.id} rider={r} onPick={() => onAssign(r.id)} />
                ))}
              </Section>
            )}
            {busy.length > 0 && (
              <Section title={`Currently Busy (${busy.length})`}>
                {busy.map((r) => (
                  <RiderRow key={r.id} rider={r} onPick={() => onAssign(r.id)} />
                ))}
              </Section>
            )}
            {idle.length === 0 && busy.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                No riders on duty.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {title}
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </section>
  );
}

function RiderRow({
  rider,
  onPick,
}: {
  rider: Rider;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-orange-50"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-200 to-orange-400 text-sm font-extrabold text-white">
        {rider.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold text-gray-900">{rider.name}</div>
        <div className="text-[11px] text-gray-500">
          {rider.vehicle} Â· â­ {rider.rating} Â· {rider.todayDeliveries} today
        </div>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${RIDER_TONE[rider.status]}`}
      >
        {rider.status}
      </span>
    </button>
  );
}

/* ---------- Order Drawer ---------- */
function OrderDrawer({
  order,
  rider,
  onClose,
  onAssign,
  onSetStatus,
}: {
  order: DeliveryOrder;
  rider?: Rider;
  onClose: () => void;
  onAssign: () => void;
  onSetStatus: (s: DeliveryStatus) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const stages: { id: DeliveryStatus; label: string; at?: number }[] = [
    { id: "Incoming", label: "Received", at: order.receivedAt },
    { id: "Preparing", label: "Preparing", at: order.receivedAt },
    { id: "Ready", label: "Ready for Pickup", at: order.readyAt },
    { id: "Out", label: "Out for Delivery", at: order.pickedAt },
    { id: "Delivered", label: "Delivered", at: order.deliveredAt },
  ];
  const currentIdx = stages.findIndex((s) => s.id === order.status);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[55] bg-gray-900/40"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 32 }}
        className="fixed right-0 top-0 z-[55] flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${SOURCE_TONE[order.source]}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[order.source]}`} />
              {order.source}
            </span>
            <h3 className="mt-1 font-mono text-lg font-extrabold text-gray-900">
              {order.id}
            </h3>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${STATUS_TONE[order.status]}`}
            >
              {order.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Customer */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Customer
            </div>
            <div className="mt-0.5 text-base font-bold text-gray-900">
              {order.customerName}
            </div>
            <div className="text-[12px] text-gray-600">
              {order.customerPhone}
            </div>
            <div className="mt-1 flex items-start gap-1 text-[12px] text-gray-700">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span>{order.address}</span>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <a
                href={`tel:${order.customerPhone}`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <Phone className="h-3.5 w-3.5" />
                Call Customer
              </a>
              <a
                href={`https://wa.me/${order.customerPhone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${order.customerName}, regarding order ${order.id}: ${order.address}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp Address
              </a>
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Items
            </div>
            <ul className="mt-1 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {order.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-3 py-2 text-sm"
                >
                  <span className="text-gray-700">
                    <strong className="font-bold text-gray-900">
                      {it.qty}Ã—
                    </strong>{" "}
                    {it.name}
                  </span>
                  <span className="font-bold tabular-nums text-gray-900">
                    {formatINR(it.qty * it.price)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between bg-gray-50 px-3 py-2 text-sm">
                <span className="font-bold text-gray-700">Total</span>
                <span className="font-extrabold tabular-nums text-gray-900">
                  {formatINR(order.total)}
                </span>
              </li>
            </ul>
            {order.notes && (
              <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                <AlertTriangle className="h-3 w-3" />
                {order.notes}
              </div>
            )}
          </div>

          {/* Rider */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <span>Rider</span>
              <button
                type="button"
                onClick={onAssign}
                className="rounded-md bg-purple-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-purple-700"
              >
                {rider ? "Reassign" : "Assign"}
              </button>
            </div>
            {rider ? (
              <div className="mt-1.5 text-sm">
                <div className="font-bold text-gray-900">{rider.name}</div>
                <div className="text-[12px] text-gray-600">
                  {rider.vehicle}
                </div>
                <div className="text-[11px] text-gray-500">{rider.phone}</div>
              </div>
            ) : (
              <div className="mt-1 text-[12px] text-gray-500">
                Not assigned yet.
              </div>
            )}
          </div>

          {/* Timeline */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Timeline
            </div>
            <ol className="relative mt-2 space-y-2 border-l-2 border-gray-200 pl-4">
              {stages.map((s, i) => {
                const isDone = i <= currentIdx;
                return (
                  <li key={s.id} className="relative">
                    <span
                      className={`absolute -left-[22px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ${
                        isDone
                          ? "bg-orange-500"
                          : "bg-white ring-2 ring-gray-300"
                      }`}
                    >
                      {isDone && (
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      )}
                    </span>
                    <div className="text-sm font-semibold text-gray-900">
                      {s.label}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {s.at ? new Date(s.at).toLocaleTimeString() : "Pending"}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
          {order.status !== "Delivered" && (
            <>
              {order.status === "Out" ? (
                <button
                  type="button"
                  onClick={() => onSetStatus("Delivered")}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white hover:bg-emerald-700"
                >
                  Mark Delivered
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const next: DeliveryStatus =
                      order.status === "Incoming"
                        ? "Preparing"
                        : order.status === "Preparing"
                          ? "Ready"
                          : "Out";
                    onSetStatus(next);
                  }}
                  className="flex-1 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110"
                  style={{ backgroundColor: "var(--primary-orange)" }}
                >
                  Advance Status
                </button>
              )}
            </>
          )}
        </footer>
      </motion.div>
    </>
  );
}

/* ---------- Snooze Modal ---------- */
function SnoozeModal({
  source,
  onClose,
  onPick,
}: {
  source: DeliverySource;
  onClose: () => void;
  onPick: (m: number) => void;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="border-b border-gray-200 px-5 py-4">
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
              Snooze {source}
            </div>
            <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
              Pause incoming orders
            </h3>
          </header>
          <div className="space-y-2 p-4">
            {[10, 15, 30, 60, 120].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onPick(m)}
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-2.5 text-left text-sm font-bold text-gray-800 hover:border-orange-300 hover:bg-orange-50"
              >
                <span>{m} minutes</span>
                <Moon className="h-4 w-4 text-gray-400" />
              </button>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export const __unused = { Truck };
