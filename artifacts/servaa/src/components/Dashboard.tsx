import { useMemo } from "react";
import {
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Users,
  Trash2,
  BarChart3,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Star,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { useFOH } from "@/context/FOHContext";
import { useKDS } from "@/context/KDSContext";
import { useSettings } from "@/context/SettingsContext";
import {
  formatINR,
  formatINRShort,
  type PaymentMode,
} from "@/lib/accountsData";
import { SEED_WASTAGE, wastageValue } from "@/lib/bohData";

/* ─── helpers ─────────────────────────────────────────────────────────── */

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-gray-900",
  delta,
}: {
  icon: typeof IndianRupee;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  delta?: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
          {label}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-50 text-gray-400">
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className={`text-2xl font-extrabold tabular-nums leading-none ${accent}`}>
        {value}
      </div>
      <div className="flex items-center gap-2">
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
              delta >= 0
                ? "bg-emerald-50 text-emerald-600"
                : "bg-red-50 text-red-500"
            }`}
          >
            {delta >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {sub && (
          <span className="text-[11px] text-gray-400">{sub}</span>
        )}
      </div>
    </div>
  );
}

/* Payment mode config */
const MODE_CONFIG: Record<
  string,
  { icon: typeof CreditCard; color: string; bar: string }
> = {
  UPI: {
    icon: Smartphone,
    color: "text-purple-600",
    bar: "bg-purple-400",
  },
  Cash: {
    icon: Banknote,
    color: "text-emerald-600",
    bar: "bg-emerald-400",
  },
  Card: {
    icon: CreditCard,
    color: "text-blue-600",
    bar: "bg-blue-400",
  },
  Wallet: {
    icon: Wallet,
    color: "text-amber-600",
    bar: "bg-amber-400",
  },
  Adjustment: {
    icon: ArrowUpRight,
    color: "text-gray-500",
    bar: "bg-gray-300",
  },
};

/* ─── Dashboard ────────────────────────────────────────────────────────── */

export function Dashboard() {
  const { income, expenses } = useAccounts();
  const { tables } = useFOH();
  const { kotsByTable } = useKDS();
  const { storeProfile } = useSettings();

  /* ── KPIs ── */
  const grossRevenue = useMemo(
    () => income.reduce((s, i) => s + i.amount, 0),
    [income],
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const netRevenue = grossRevenue - totalExpenses;

  const occupancyData = useMemo(() => {
    const occupied = tables.filter(
      (t) =>
        t.status === "Occupied" || t.status === "Waiting for Settlement",
    ).length;
    return {
      occupied,
      total: tables.length,
      pct: tables.length > 0 ? Math.round((occupied / tables.length) * 100) : 0,
    };
  }, [tables]);

  const wastageTotal = useMemo(
    () => Math.round(SEED_WASTAGE.reduce((s, w) => s + wastageValue(w), 0)),
    [],
  );

  const aov = income.length > 0 ? Math.round(grossRevenue / income.length) : 0;

  /* ── Payment split ── */
  const paymentSplit = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of income) {
      map[i.mode] = (map[i.mode] ?? 0) + i.amount;
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([mode, amount]) => ({ mode: mode as PaymentMode, amount }));
  }, [income]);

  /* ── Top-5 items ── */
  const top5 = useMemo(() => {
    const allKots = Object.values(kotsByTable).flat();
    const map = new Map<string, { qty: number; revenue: number }>();
    for (const kot of allKots) {
      for (const item of kot.items) {
        if (item.isVoided) continue;
        const ex = map.get(item.name) ?? { qty: 0, revenue: 0 };
        map.set(item.name, {
          qty: ex.qty + item.quantity,
          revenue: ex.revenue + item.price * item.quantity,
        });
      }
    }
    return [...map.entries()]
      .map(([name, { qty, revenue }]) => ({ name, qty, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [kotsByTable]);

  /* ── Recent bills ── */
  const recentBills = useMemo(
    () => [...income].sort((a, b) => b.at - a.at).slice(0, 6),
    [income],
  );

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {today}
          </p>
          <h2 className="mt-0.5 text-lg font-extrabold text-gray-900">
            {storeProfile.name} · Live Overview
          </h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600 ring-1 ring-emerald-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={IndianRupee}
          label="Today's Net Revenue"
          value={formatINRShort(netRevenue)}
          accent={netRevenue >= 0 ? "text-gray-900" : "text-red-600"}
          sub={`${income.length} bills · ${formatINRShort(grossRevenue)} gross`}
        />
        <KpiCard
          icon={Users}
          label="Table Occupancy"
          value={`${occupancyData.pct}%`}
          accent="text-[color:var(--primary-orange)]"
          sub={`${occupancyData.occupied} of ${occupancyData.total} tables`}
        />
        <KpiCard
          icon={Trash2}
          label="Wastage Impact"
          value={formatINRShort(wastageTotal)}
          accent="text-red-600"
          sub={`${SEED_WASTAGE.length} entries · last 30 days`}
        />
        <KpiCard
          icon={BarChart3}
          label="Avg Order Value"
          value={income.length > 0 ? formatINR(aov) : "—"}
          accent="text-gray-900"
          sub={income.length > 0 ? `across ${income.length} orders` : "No orders yet"}
        />
      </div>

      {/* Main two-col row */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Payment split */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-bold text-gray-900">
                Payment Split · Today
              </h3>
            </div>
            <span className="text-xs font-semibold text-gray-400">
              {formatINRShort(grossRevenue)} total
            </span>
          </div>

          {grossRevenue === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              No payments settled yet today.
            </p>
          ) : (
            <div className="divide-y divide-gray-50 px-4 py-2">
              {paymentSplit.map(({ mode, amount }) => {
                const cfg = MODE_CONFIG[mode] ?? MODE_CONFIG.Adjustment;
                const ModeIcon = cfg.icon;
                const pct = Math.round((amount / grossRevenue) * 100);
                return (
                  <div key={mode} className="flex items-center gap-3 py-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-50 ${cfg.color}`}
                    >
                      <ModeIcon className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-800">
                          {mode}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-gray-900">
                          {formatINRShort(amount)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full transition-all ${cfg.bar}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums text-gray-400">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top-5 items */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
            <Star className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Top Items · By Revenue (Today's KOTs)
            </h3>
          </div>

          {top5.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-gray-400">
              No KOT items fired yet — send the first order from FOH.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {top5.map(({ name, qty, revenue }, i) => {
                const maxRev = top5[0].revenue;
                const barPct = Math.round((revenue / maxRev) * 100);
                return (
                  <li key={name} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-50 text-xs font-extrabold text-orange-500">
                      {i + 1}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-semibold text-gray-800">
                          {name}
                        </span>
                        <span className="ml-2 shrink-0 text-sm font-bold tabular-nums text-gray-900">
                          {formatINRShort(revenue)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-orange-400 transition-all"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-right text-xs font-bold tabular-nums text-gray-400">
                      ×{qty}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Recent bills + table status */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Recent bills */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
            <Clock className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Recent Bills</h3>
          </div>
          {recentBills.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              No bills settled yet today.
            </p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {recentBills.map((bill) => {
                const time = new Date(bill.at).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const modeCfg = MODE_CONFIG[bill.mode] ?? MODE_CONFIG.Adjustment;
                const ModeIcon = modeCfg.icon;
                return (
                  <li
                    key={bill.id}
                    className="flex items-center gap-3 px-4 py-2.5"
                  >
                    <ModeIcon className={`h-4 w-4 shrink-0 ${modeCfg.color}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm font-semibold text-gray-800">
                          {bill.table}
                        </span>
                        <span className="ml-2 shrink-0 text-sm font-bold tabular-nums text-gray-900">
                          {formatINR(bill.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <span>{time}</span>
                        <span>·</span>
                        <span>{bill.server}</span>
                        <span>·</span>
                        <span>{bill.mode}</span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Table status overview */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center gap-1.5 border-b border-gray-100 px-4 py-3">
            <Users className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Floor Status · All Tables
            </h3>
          </div>
          <div className="p-4">
            {(() => {
              const counts: Record<string, number> = {};
              for (const t of tables) {
                counts[t.status] = (counts[t.status] ?? 0) + 1;
              }
              const STATUS_STYLE: Record<
                string,
                { dot: string; label: string }
              > = {
                Vacant: { dot: "bg-gray-300", label: "Vacant" },
                Occupied: { dot: "bg-emerald-500", label: "Occupied" },
                "Waiting for Settlement": {
                  dot: "bg-amber-400",
                  label: "Awaiting Bill",
                },
                Cleaning: { dot: "bg-blue-400", label: "Cleaning" },
                Reserved: { dot: "bg-purple-400", label: "Reserved" },
              };
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {Object.entries(STATUS_STYLE).map(([status, { dot, label }]) => (
                    <div
                      key={status}
                      className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                      <div className="min-w-0">
                        <div className="truncate text-[11px] text-gray-500">
                          {label}
                        </div>
                        <div className="text-base font-extrabold tabular-nums text-gray-900">
                          {counts[status] ?? 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
