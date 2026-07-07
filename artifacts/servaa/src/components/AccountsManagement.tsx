import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Lock,
  Unlock,
  TrendingUp,
  TrendingDown,
  Wallet,
  IndianRupee,
  AlertTriangle,
  Plus,
  X,
  Check,
  Upload,
  ArrowRight,
  ArrowLeft,
  Calculator,
  Truck,
  PieChart,
  ShieldCheck,
  Receipt,
  ChevronRight,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import {
  CATEGORY_TONE,
  DENOMINATIONS,
  EXPENSE_CATEGORIES,
  OPENING_FLOAT,
  PAYMENT_TONE,
  PNL_MONTHS,
  SEED_VENDORS,
  VENDOR_TONE,
  formatINR,
  formatINRShort,
  type ExpenseCategory,
  type ExpenseRow,
  type IncomeRow,
  type PaymentMode,
  type VendorPayout,
} from "@/lib/accountsData";
import { useCollectionState } from "@/lib/collectionState";
import { useAccounts } from "@/context/AccountsContext";
import { CATEGORY_PERF } from "@/lib/reportsData";

type TabId = "cashbook" | "eod" | "pnl" | "vendors";

const TABS: { id: TabId; label: string; icon: typeof BookOpen }[] = [
  { id: "cashbook", label: "Daily Cashbook", icon: BookOpen },
  { id: "eod", label: "EOD Closing", icon: Calculator },
  { id: "pnl", label: "Profit & Loss", icon: PieChart },
  { id: "vendors", label: "Vendor Payouts", icon: Truck },
];

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

export function AccountsManagement() {
  const [tab, setTab] = useState<TabId>("cashbook");
  const { income, expenses, postExpense } = useAccounts();
  const [vendors, setVendors] = useCollectionState<VendorPayout[]>("accounts_vendor_payouts", SEED_VENDORS);
  const [locked, setLocked] = useState(false);
  const [physicalCash, setPhysicalCash] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pinPrompt, setPinPrompt] = useState(false);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  /* ---------- KPIs ---------- */
  // 7-day daily-average revenue derived from the CATEGORY_PERF baseline (base mult=1).
  const sevenDayDailyAvg = useMemo(
    () => CATEGORY_PERF.reduce((s, c) => s + c.revenue, 0) / 7,
    [],
  );

  const kpis = useMemo(() => {
    const grossRevenue = income.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const cashSales = income
      .filter((i) => i.mode === "Cash")
      .reduce((s, i) => s + i.amount, 0);
    const cashExpenses = expenses
      .filter((e) => e.mode === "Cash")
      .reduce((s, e) => s + e.amount, 0);
    const netCash = OPENING_FLOAT + cashSales - cashExpenses;
    const variance = physicalCash !== null ? physicalCash - netCash : 0;
    return {
      grossRevenue,
      totalExpenses,
      netCash,
      variance,
      cashSales,
      cashExpenses,
    };
  }, [income, expenses, physicalCash]);

  const addExpense = (e: Omit<ExpenseRow, "id" | "at">) => {
    postExpense({ ...e, at: Date.now() });
    pushToast(`Expense ${formatINR(e.amount)} recorded`);
  };

  // Tracks the cumulative amount already paid per vendor so rapid double-clicks
  // cannot post the same payout to the outflow ledger twice (a ref updates
  // synchronously, unlike the async `vendors` state closure).
  const paidRef = useRef<Record<string, number>>({});

  const recordPayout = (id: string, amount: number) => {
    if (amount <= 0) return;
    const vendor = vendors.find((v) => v.id === id);
    if (!vendor) return;
    const alreadyPaid = paidRef.current[id] ?? vendor.paid;
    const delta = Math.min(amount, vendor.amount - alreadyPaid);
    if (delta <= 0) return;
    paidRef.current[id] = alreadyPaid + delta;

    setVendors((arr) =>
      arr.map((v) => {
        if (v.id !== id) return v;
        const paid = Math.min(v.amount, v.paid + delta);
        const status: VendorPayout["status"] =
          paid >= v.amount
            ? "Paid"
            : paid > 0
              ? "Partially Paid"
              : v.dueAt < Date.now()
                ? "Overdue"
                : "Pending";
        return { ...v, paid, status };
      }),
    );
    // Outflow automation: flagging a vendor invoice as paid instantly posts the
    // settled amount to the expense (outflow) ledger â€” zero manual entry.
    postExpense({
      at: Date.now(),
      description: `Vendor payout Â· ${vendor.vendor} (${vendor.poId})`,
      category: "Groceries",
      amount: delta,
      mode: "UPI",
      hasBill: true,
      paidTo: vendor.vendor,
    });
    pushToast(`Payout ${formatINR(delta)} posted to outflow ledger`);
  };

  const onLock = () => {
    if (locked) {
      setPinPrompt(true);
    } else {
      if (physicalCash === null) {
        pushToast("Run EOD physical count before locking the day", "warn");
        setTab("eod");
        return;
      }
      setLocked(true);
      pushToast("Day locked Â· entries are read-only", "info");
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={IndianRupee}
          label="Gross Revenue"
          value={formatINRShort(kpis.grossRevenue)}
          accent="text-gray-900"
          sub={`${income.length} bills today`}
          delta={
            sevenDayDailyAvg > 0
              ? +((kpis.grossRevenue / sevenDayDailyAvg - 1) * 100).toFixed(1)
              : 0
          }
        />
        <KpiCard
          icon={TrendingDown}
          label="Total Expenses"
          value={formatINRShort(kpis.totalExpenses)}
          accent="text-red-600"
          sub={`${expenses.length} entries Â· ${formatINR(kpis.cashExpenses)} cash`}
        />
        <KpiCard
          icon={Wallet}
          label="Net Cash in Hand"
          value={formatINRShort(kpis.netCash)}
          accent="text-emerald-600"
          sub={`Float ${formatINR(OPENING_FLOAT)} + Sales âˆ’ Expenses`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Variance"
          value={
            physicalCash === null ? "â€”" : formatINR(kpis.variance)
          }
          accent={
            physicalCash === null
              ? "text-gray-400"
              : kpis.variance < 0
                ? "text-red-600"
                : kpis.variance > 0
                  ? "text-amber-600"
                  : "text-emerald-600"
          }
          sub={
            physicalCash === null
              ? "Awaiting physical count"
              : kpis.variance < 0
                ? "SHORTAGE â€” investigate"
                : kpis.variance > 0
                  ? "EXCESS in till"
                  : "Books match till exactly"
          }
        />
      </div>

      {/* Tabs + lock */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold uppercase tracking-wide transition ${
                  isActive ? "text-white" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="accounts-tab-pill"
                    className="absolute inset-0 rounded-lg shadow-sm"
                    style={{ backgroundColor: "var(--primary-orange)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5" />
                <span className="relative z-10">{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onLock}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide ring-1 transition ${
            locked
              ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100"
              : "bg-white text-gray-700 ring-gray-200 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          }`}
        >
          {locked ? (
            <Lock className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          {locked ? "Day Locked Â· Tap to unlock" : "Lock Day"}
        </button>
      </div>

      {tab === "cashbook" && (
        <CashbookView
          income={income}
          expenses={expenses}
          locked={locked}
          onAddExpense={addExpense}
        />
      )}
      {tab === "eod" && (
        <EodView
          income={income}
          expensesCash={kpis.cashExpenses}
          openingFloat={OPENING_FLOAT}
          netCash={kpis.netCash}
          locked={locked}
          onConfirm={(physical) => {
            setPhysicalCash(physical);
            const variance = physical - kpis.netCash;
            pushToast(
              variance === 0
                ? "Cash matched till perfectly"
                : variance < 0
                  ? `Shortage logged: ${formatINR(variance)}`
                  : `Excess logged: ${formatINR(variance)}`,
              variance < 0 ? "warn" : "success",
            );
          }}
        />
      )}
      {tab === "pnl" && <PnLView />}
      {tab === "vendors" && (
        <VendorsView
          vendors={vendors}
          locked={locked}
          onPayout={recordPayout}
        />
      )}

      {/* PIN modal */}
      <AnimatePresence>
        {pinPrompt && (
          <PinModal
            onClose={() => setPinPrompt(false)}
            onSubmit={(pin) => {
              if (pin === "1234") {
                setLocked(false);
                setPinPrompt(false);
                pushToast("Day unlocked by Admin", "info");
              } else {
                pushToast("Invalid Admin PIN", "warn");
              }
            }}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
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

/* ---------- KPI Card ---------- */
function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
  accent = "text-gray-900",
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
  delta?: number;
  sub?: string;
  accent?: string;
}) {
  const up = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-2xl font-extrabold ${accent}`}>{value}</span>
        {delta !== undefined && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
              up ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {up ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {sub && <div className="truncate text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

/* ============================================================
   CASHBOOK
   ============================================================ */
function CashbookView({
  income,
  expenses,
  locked,
  onAddExpense,
}: {
  income: IncomeRow[];
  expenses: ExpenseRow[];
  locked: boolean;
  onAddExpense: (e: Omit<ExpenseRow, "id" | "at">) => void;
}) {
  const [adding, setAdding] = useState(false);
  const totalIn = income.reduce((s, i) => s + i.amount, 0);
  const totalOut = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Inflow */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-emerald-100 bg-emerald-50/40 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-800">
              Inflow Â· Settled Bills
            </h3>
          </div>
          <span className="text-sm font-extrabold tabular-nums text-emerald-700">
            +{formatINR(totalIn)}
          </span>
        </div>
        <ul className="max-h-[480px] divide-y divide-gray-100 overflow-y-auto">
          {income.map((i) => (
            <li
              key={i.id}
              className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2 hover:bg-emerald-50/30"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-gray-400">
                    {i.id}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${PAYMENT_TONE[i.mode]}`}
                  >
                    {i.mode}
                  </span>
                </div>
                <div className="truncate text-sm font-semibold text-gray-800">
                  {i.table}
                </div>
                <div className="text-[10px] text-gray-500">
                  {new Date(i.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  Â· {i.server}
                </div>
              </div>
              <div className="text-right text-sm font-bold tabular-nums text-emerald-700">
                +{formatINR(i.amount)}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Outflow */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b-2 border-red-100 bg-red-50/40 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="h-4 w-4 text-red-600" />
            <h3 className="text-sm font-bold text-red-800">
              Outflow Â· Expenses
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold tabular-nums text-red-700">
              âˆ’{formatINR(totalOut)}
            </span>
            <button
              type="button"
              disabled={locked}
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Plus className="h-3 w-3" />
              Record Expense
            </button>
          </div>
        </div>
        <ul className="max-h-[480px] divide-y divide-gray-100 overflow-y-auto">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-2 hover:bg-red-50/30"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[10px] font-bold text-gray-400">
                    {e.id}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${CATEGORY_TONE[e.category]}`}
                  >
                    {e.category}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ring-1 ${PAYMENT_TONE[e.mode]}`}
                  >
                    {e.mode}
                  </span>
                  {e.hasBill && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                      <Receipt className="h-2.5 w-2.5" />
                      Bill
                    </span>
                  )}
                </div>
                <div className="truncate text-sm font-semibold text-gray-800">
                  {e.description}
                </div>
                <div className="text-[10px] text-gray-500">
                  {new Date(e.at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {e.paidTo ? ` Â· to ${e.paidTo}` : ""}
                </div>
              </div>
              <div className="text-right text-sm font-bold tabular-nums text-red-700">
                âˆ’{formatINR(e.amount)}
              </div>
            </li>
          ))}
          {expenses.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-400">
              No expenses recorded today.
            </li>
          )}
        </ul>
      </div>

      <AnimatePresence>
        {adding && (
          <ExpenseModal
            onClose={() => setAdding(false)}
            onSave={(e) => {
              onAddExpense(e);
              setAdding(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpenseModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (e: Omit<ExpenseRow, "id" | "at">) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const [amount, setAmount] = useState(0);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Groceries");
  const [mode, setMode] = useState<PaymentMode>("Cash");
  const [paidTo, setPaidTo] = useState("");
  const [hasBill, setHasBill] = useState(false);

  const valid = amount > 0 && description.trim().length > 0;

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
                New Expense
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                Record Outflow
              </h3>
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
          <div className="space-y-3 p-5">
            <div>
              <Label>Amount (â‚¹)</Label>
              <input
                type="number"
                min={0}
                value={amount || ""}
                onChange={(e) =>
                  setAmount(Math.max(0, Number(e.target.value) || 0))
                }
                placeholder="0"
                className="h-12 w-full rounded-lg border border-gray-200 px-3 text-2xl font-extrabold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <Label>Description</Label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Vegetable mandi Â· daily run"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1.5">
                {EXPENSE_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 transition ${
                      category === c
                        ? CATEGORY_TONE[c]
                        : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Payment Mode</Label>
              <div className="flex gap-1.5">
                {(["Cash", "UPI", "Card", "Wallet"] as PaymentMode[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
                        mode === m
                          ? "border-orange-300 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {m}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div>
              <Label>Paid To (optional)</Label>
              <input
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="Vendor / Person"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setHasBill((b) => !b)}
              className={`flex w-full items-center justify-between rounded-lg border-2 border-dashed px-4 py-3 text-sm font-bold transition ${
                hasBill
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-gray-300 bg-gray-50 text-gray-500 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <Upload className="h-4 w-4" />
                {hasBill ? "Bill attached Â· click to remove" : "Upload bill (placeholder)"}
              </span>
              {hasBill && <Check className="h-4 w-4" />}
            </button>
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={() =>
                onSave({
                  amount,
                  description,
                  category,
                  mode,
                  paidTo: paidTo.trim() || undefined,
                  hasBill,
                })
              }
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Check className="h-4 w-4" />
              Save Expense
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
      {children}
    </label>
  );
}

/* ============================================================
   EOD CLOSING WIZARD
   ============================================================ */
function EodView({
  income,
  expensesCash,
  openingFloat,
  netCash,
  locked,
  onConfirm,
}: {
  income: IncomeRow[];
  expensesCash: number;
  openingFloat: number;
  netCash: number;
  locked: boolean;
  onConfirm: (physical: number) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [reason, setReason] = useState("");

  const splits = useMemo(() => {
    const map = new Map<PaymentMode, { value: number; count: number }>();
    income.forEach((i) => {
      const cur = map.get(i.mode) ?? { value: 0, count: 0 };
      cur.value += i.amount;
      cur.count += 1;
      map.set(i.mode, cur);
    });
    return (["Cash", "UPI", "Card", "Wallet"] as PaymentMode[]).map((m) => ({
      mode: m,
      ...(map.get(m) ?? { value: 0, count: 0 }),
    }));
  }, [income]);

  const physicalTotal = useMemo(
    () =>
      DENOMINATIONS.reduce((s, d) => s + d * (counts[d] ?? 0), 0),
    [counts],
  );
  const variance = physicalTotal - netCash;

  const updateCount = (denom: number, n: number) => {
    setCounts((c) => ({ ...c, [denom]: Math.max(0, Math.floor(n) || 0) }));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Stepper header */}
      <div className="border-b border-gray-100 bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Sales Reconciliation" },
            { n: 2, label: "Physical Count" },
            { n: 3, label: "Discrepancy Check" },
          ].map((s, i, arr) => {
            const done = step > s.n;
            const active = step === s.n;
            return (
              <div key={s.n} className="flex flex-1 items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold ring-2 ${
                    done
                      ? "bg-emerald-500 text-white ring-emerald-300"
                      : active
                        ? "bg-orange-500 text-white ring-orange-300"
                        : "bg-white text-gray-400 ring-gray-200"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[11px] font-bold uppercase tracking-wider ${
                      active ? "text-orange-700" : done ? "text-emerald-700" : "text-gray-400"
                    }`}
                  >
                    Step {s.n}
                  </div>
                  <div
                    className={`truncate text-sm font-bold ${
                      active ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    {s.label}
                  </div>
                </div>
                {i < arr.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-gray-300" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-5">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Sales Reconciliation
              </h3>
              <p className="text-[11px] text-gray-500">
                Confirm today's sales split before counting cash.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {splits.map((s) => (
                <div
                  key={s.mode}
                  className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
                >
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-gray-500">
                    <span>{s.mode}</span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] text-gray-500 ring-1 ring-gray-200">
                      {s.count} txns
                    </span>
                  </div>
                  <div className="mt-1 text-lg font-extrabold tabular-nums text-gray-900">
                    {formatINR(s.value)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between rounded-xl border-2 border-dashed border-orange-300 bg-orange-50 p-3 text-sm">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                  Expected cash in till
                </div>
                <div className="text-[11px] text-orange-700">
                  Float {formatINR(openingFloat)} + Cash sales{" "}
                  {formatINR(splits.find((s) => s.mode === "Cash")?.value ?? 0)} âˆ’
                  Cash expenses {formatINR(expensesCash)}
                </div>
              </div>
              <div className="text-2xl font-extrabold tabular-nums text-orange-700">
                {formatINR(netCash)}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Physical Cash Count
              </h3>
              <p className="text-[11px] text-gray-500">
                Type in the actual count for each denomination in your till.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DENOMINATIONS.map((d) => {
                const n = counts[d] ?? 0;
                return (
                  <div
                    key={d}
                    className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
                  >
                    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                      â‚¹{d} note
                    </div>
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={n || ""}
                        onChange={(e) => updateCount(d, Number(e.target.value))}
                        placeholder="0"
                        className="h-10 w-full rounded-md border border-gray-200 px-2 text-right text-lg font-extrabold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                      />
                      <span className="text-[10px] font-bold text-gray-400">
                        Ã—
                      </span>
                    </div>
                    <div className="mt-1 text-right text-[11px] font-bold tabular-nums text-gray-700">
                      = {formatINR(d * n)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between rounded-xl border-2 border-orange-300 bg-orange-50 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-orange-700">
                Counted total
              </div>
              <div className="text-2xl font-extrabold tabular-nums text-orange-700">
                {formatINR(physicalTotal)}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">
                Discrepancy Check
              </h3>
              <p className="text-[11px] text-gray-500">
                Compare the till count with the system's expected cash.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <SummaryTile label="Expected" value={formatINR(netCash)} />
              <SummaryTile
                label="Counted"
                value={formatINR(physicalTotal)}
                accent="text-orange-700"
              />
              <SummaryTile
                label="Variance"
                value={formatINR(variance)}
                accent={
                  variance < 0
                    ? "text-red-600"
                    : variance > 0
                      ? "text-amber-600"
                      : "text-emerald-600"
                }
              />
            </div>
            {variance !== 0 ? (
              <div
                className={`rounded-xl border-2 p-3 ${
                  variance < 0
                    ? "border-red-300 bg-red-50"
                    : "border-amber-300 bg-amber-50"
                }`}
              >
                <div className="flex items-center gap-1.5 text-sm font-bold">
                  <AlertTriangle
                    className={`h-4 w-4 ${
                      variance < 0 ? "text-red-600" : "text-amber-600"
                    }`}
                  />
                  <span
                    className={
                      variance < 0 ? "text-red-700" : "text-amber-700"
                    }
                  >
                    {variance < 0 ? "Cash shortage detected" : "Excess in till"}
                    {" â€” "}
                    {formatINR(Math.abs(variance))} {variance < 0 ? "missing" : "extra"}
                  </span>
                </div>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder={
                    variance < 0
                      ? "Reason for shortage (mandatory) â€” e.g. 'Change miscount at table 12'"
                      : "Note for excess (e.g. 'Tip kept in till by mistake')"
                  }
                  className={`mt-2 w-full rounded-lg border bg-white p-2 text-sm focus:outline-none focus:ring-2 ${
                    variance < 0
                      ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                      : "border-amber-300 focus:border-amber-300 focus:ring-amber-100"
                  }`}
                />
              </div>
            ) : (
              <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                <CheckCircle2 className="mr-1.5 inline h-4 w-4" />
                Books match till exactly. Nice close.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wizard footer */}
      <footer className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
        <button
          type="button"
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}
          disabled={step === 1}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">
          <CircleDot className="h-3 w-3" />
          Step {step} of 3
        </div>
        {step < 3 ? (
          <button
            type="button"
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
            disabled={step === 2 && physicalTotal === 0}
            className="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            Next
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={
              locked || (variance < 0 && reason.trim().length === 0)
            }
            onClick={() => onConfirm(physicalTotal)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShieldCheck className="h-4 w-4" />
            Confirm & Close
          </button>
        )}
      </footer>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  accent = "text-gray-900",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 text-center">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-2xl font-extrabold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

/* ============================================================
   PROFIT & LOSS
   ============================================================ */
function PnLView() {
  const { income, expenses } = useAccounts();

  // Current calendar month string "YYYY-MM"
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Build a live PnLMonth for the current calendar month from the shared ledgers.
  // This is the same data source that Cashbook and EOD use, so all three views
  // always agree.
  const liveCurrent = useMemo(() => {
    const inMonth = (ts: number) => {
      const d = new Date(ts);
      return (
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` ===
        currentMonthStr
      );
    };
    const monthIncome = income.filter((r) => inMonth(r.at));
    const monthExp = expenses.filter((e) => inMonth(e.at));
    const revenue = monthIncome.reduce((s, r) => s + r.amount, 0);
    const cogs = monthExp
      .filter((e) => e.category === "Groceries")
      .reduce((s, e) => s + e.amount, 0);
    const rent = monthExp
      .filter((e) => e.category === "Rent")
      .reduce((s, e) => s + e.amount, 0);
    const utilities = monthExp
      .filter((e) => e.category === "Utilities")
      .reduce((s, e) => s + e.amount, 0);
    const marketing = monthExp
      .filter((e) => e.category === "Marketing")
      .reduce((s, e) => s + e.amount, 0);
    const other = monthExp
      .filter(
        (e) =>
          !["Groceries", "Rent", "Utilities", "Marketing"].includes(
            e.category,
          ),
      )
      .reduce((s, e) => s + e.amount, 0);
    // Salaries have no matching expense category yet â€” carry seed value forward
    const seedLast = PNL_MONTHS[PNL_MONTHS.length - 1];
    return {
      month: currentMonthStr,
      revenue,
      cogs,
      salaries: seedLast.salaries,
      rent,
      utilities,
      marketing,
      other,
    };
  }, [income, expenses, currentMonthStr]);

  // Historical seed months + live current month. All columns draw from the
  // same live AccountsContext, ending in a "This Month" column.
  const allMonths = useMemo(
    () => [...PNL_MONTHS, liveCurrent],
    [liveCurrent],
  );

  const current = liveCurrent;
  const opex = (m: (typeof allMonths)[number]) =>
    m.salaries + m.rent + m.utilities + m.marketing + m.other;
  const profit = (m: (typeof allMonths)[number]) =>
    m.revenue - m.cogs - opex(m);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={IndianRupee}
          label="MTD Revenue"
          value={formatINRShort(current.revenue)}
          accent="text-gray-900"
        />
        <KpiCard
          icon={TrendingDown}
          label="MTD COGS"
          value={formatINRShort(current.cogs)}
          accent="text-red-600"
          sub={`${((current.cogs / Math.max(1, current.revenue)) * 100).toFixed(1)}% of sales`}
        />
        <KpiCard
          icon={TrendingDown}
          label="MTD Opex"
          value={formatINRShort(opex(current))}
          accent="text-red-600"
        />
        <KpiCard
          icon={TrendingUp}
          label="MTD Net Profit"
          value={formatINRShort(profit(current))}
          accent="text-emerald-600"
          sub={`Margin ${((profit(current) / Math.max(1, current.revenue)) * 100).toFixed(1)}%`}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">
            Profit & Loss Â· Historical + This Month (live)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-right text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2 text-left">Line Item</th>
                {allMonths.map((m, i) => (
                  <th
                    key={m.month}
                    className={`px-4 py-2 ${i === allMonths.length - 1 ? "bg-orange-50/40 text-orange-700" : ""}`}
                  >
                    {i === allMonths.length - 1
                      ? "This Month â—"
                      : new Date(m.month + "-01").toLocaleDateString("en-IN", {
                          month: "short",
                          year: "2-digit",
                        })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <PnLRow
                label="Revenue (FOH Sales)"
                positive
                bold
                values={allMonths.map((m) => m.revenue)}
              />
              <PnLRow
                label="(âˆ’) Cost of Goods Sold"
                negative
                indent
                values={allMonths.map((m) => -m.cogs)}
                sublabel="GRN + prep batches + wastage"
              />
              <PnLRow
                label="= Gross Profit"
                positive
                bold
                divider
                values={allMonths.map((m) => m.revenue - m.cogs)}
              />
              <PnLRow
                label="(âˆ’) Salaries"
                negative
                indent
                values={allMonths.map((m) => -m.salaries)}
              />
              <PnLRow
                label="(âˆ’) Rent"
                negative
                indent
                values={allMonths.map((m) => -m.rent)}
              />
              <PnLRow
                label="(âˆ’) Utilities"
                negative
                indent
                values={allMonths.map((m) => -m.utilities)}
              />
              <PnLRow
                label="(âˆ’) Marketing"
                negative
                indent
                values={allMonths.map((m) => -m.marketing)}
              />
              <PnLRow
                label="(âˆ’) Other Opex"
                negative
                indent
                values={allMonths.map((m) => -m.other)}
              />
              <PnLRow
                label="= NET PROFIT"
                bold
                divider
                highlight
                values={allMonths.map((m) => profit(m))}
              />
              <PnLRow
                label="Net Margin"
                muted
                values={allMonths.map(
                  (m) => (profit(m) / Math.max(1, m.revenue)) * 100,
                )}
                isPercent
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PnLRow({
  label,
  values,
  positive,
  negative,
  bold,
  indent,
  divider,
  highlight,
  muted,
  isPercent,
  sublabel,
}: {
  label: string;
  values: number[];
  positive?: boolean;
  negative?: boolean;
  bold?: boolean;
  indent?: boolean;
  divider?: boolean;
  highlight?: boolean;
  muted?: boolean;
  isPercent?: boolean;
  sublabel?: string;
}) {
  return (
    <tr
      className={`text-right ${divider ? "border-t-2 border-gray-200" : ""} ${
        highlight ? "bg-emerald-50/40" : ""
      }`}
    >
      <td
        className={`px-4 py-2 text-left ${indent ? "pl-8" : ""} ${
          bold
            ? highlight
              ? "text-base font-extrabold text-emerald-700"
              : "font-extrabold text-gray-900"
            : muted
              ? "text-[11px] font-semibold uppercase tracking-wider text-gray-400"
              : "text-gray-700"
        }`}
      >
        <div>{label}</div>
        {sublabel && (
          <div className="text-[10px] font-normal text-gray-400">
            {sublabel}
          </div>
        )}
      </td>
      {values.map((v, i) => {
        const isCurrent = i === values.length - 1;
        const fmt = isPercent
          ? `${v.toFixed(1)}%`
          : formatINRShort(v);
        return (
          <td
            key={i}
            className={`px-4 py-2 tabular-nums ${
              isCurrent ? "bg-orange-50/40 font-bold" : ""
            } ${
              bold
                ? highlight
                  ? "text-base font-extrabold text-emerald-700"
                  : positive
                    ? "font-extrabold text-emerald-700"
                    : "font-extrabold text-gray-900"
                : negative
                  ? "text-red-600"
                  : positive
                    ? "text-emerald-700"
                    : muted
                      ? "text-[11px] text-gray-400"
                      : "text-gray-700"
            }`}
          >
            {fmt}
          </td>
        );
      })}
    </tr>
  );
}

/* ============================================================
   VENDOR PAYOUTS
   ============================================================ */
function VendorsView({
  vendors,
  locked,
  onPayout,
}: {
  vendors: VendorPayout[];
  locked: boolean;
  onPayout: (id: string, amount: number) => void;
}) {
  const totals = useMemo(() => {
    let total = 0,
      paid = 0,
      overdue = 0,
      pending = 0;
    vendors.forEach((v) => {
      total += v.amount;
      paid += v.paid;
      const remaining = v.amount - v.paid;
      if (v.status === "Overdue") overdue += remaining;
      else if (v.status !== "Paid") pending += remaining;
    });
    return { total, paid, overdue, pending };
  }, [vendors]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Truck}
          label="Total Outstanding"
          value={formatINRShort(totals.total - totals.paid)}
          accent="text-gray-900"
          sub={`across ${vendors.filter((v) => v.status !== "Paid").length} vendors`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue"
          value={formatINRShort(totals.overdue)}
          accent={totals.overdue > 0 ? "text-red-600" : "text-emerald-600"}
          sub={`${vendors.filter((v) => v.status === "Overdue").length} POs past due`}
        />
        <KpiCard
          icon={CircleDot}
          label="Pending"
          value={formatINRShort(totals.pending)}
          accent="text-blue-600"
        />
        <KpiCard
          icon={CheckCircle2}
          label="Paid YTD"
          value={formatINRShort(totals.paid)}
          accent="text-emerald-600"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">
            Vendor Payouts Â· linked to BOH Purchase Orders
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">PO</th>
                <th className="px-4 py-2 text-right">PO Total</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Remaining</th>
                <th className="px-4 py-2">Due</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendors.map((v) => {
                const remaining = v.amount - v.paid;
                const overdueDays = Math.floor(
                  (Date.now() - v.dueAt) / (24 * 60 * 60 * 1000),
                );
                const pct = (v.paid / Math.max(1, v.amount)) * 100;
                return (
                  <tr key={v.id} className="hover:bg-orange-50/30">
                    <td className="px-4 py-2">
                      <div className="text-sm font-bold text-gray-900">
                        {v.vendor}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {v.category}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span className="font-mono text-[11px] font-bold text-gray-700">
                        {v.poId}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-900">
                      {formatINR(v.amount)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                      {v.paid > 0 ? formatINR(v.paid) : "â€”"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="font-bold tabular-nums text-gray-900">
                        {formatINR(remaining)}
                      </div>
                      <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${
                            v.status === "Paid"
                              ? "bg-emerald-500"
                              : v.status === "Partially Paid"
                                ? "bg-amber-500"
                                : "bg-gray-300"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-2 text-[11px]">
                      <div className="text-gray-700">
                        {new Date(v.dueAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </div>
                      {v.status === "Overdue" && overdueDays > 0 && (
                        <div className="font-bold text-red-600">
                          {overdueDays}d overdue
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${VENDOR_TONE[v.status]}`}
                      >
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      {v.status !== "Paid" && (
                        <button
                          type="button"
                          disabled={locked}
                          onClick={() => onPayout(v.id, remaining)}
                          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                          style={{ backgroundColor: "var(--primary-orange)" }}
                        >
                          <Wallet className="h-3 w-3" />
                          Pay {formatINRShort(remaining)}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PIN MODAL
   ============================================================ */
function PinModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (pin: string) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const [pin, setPin] = useState("");
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
          <header className="flex items-center gap-2 border-b border-gray-200 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 ring-2 ring-red-200">
              <Unlock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                Restricted Action
              </div>
              <h3 className="text-base font-extrabold text-gray-900">
                Admin PIN Required
              </h3>
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
          <div className="space-y-3 p-5">
            <p className="text-[12px] text-gray-600">
              Day is locked. Enter the Admin PIN to unlock and edit entries.
            </p>
            <input
              type="password"
              value={pin}
              autoFocus
              maxLength={6}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              placeholder="â€¢â€¢â€¢â€¢"
              className="h-14 w-full rounded-lg border-2 border-gray-200 px-3 text-center text-3xl font-extrabold tracking-[0.5em] tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
            />
            <div className="text-center text-[10px] text-gray-400">
              Hint: demo PIN is <strong className="text-gray-700">1234</strong>
            </div>
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSubmit(pin)}
              disabled={pin.length < 4}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Unlock className="h-4 w-4" />
              Unlock
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}
