import { useMemo, useState } from "react";
import { SunMedium, ChevronDown, ChevronUp, Printer } from "lucide-react";
import { useAccounts } from "@/context/AccountsContext";
import { useFOH } from "@/context/FOHContext";
import { useRole } from "@/context/RoleContext";

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function EndOfDay() {
  const { can } = useRole();
  const { income, expenses } = useAccounts();
  const { completedOrders } = useFOH();
  const [expanded, setExpanded] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const report = useMemo(() => {
    const todayTs = new Date().setHours(0, 0, 0, 0);
    const todayEnd = todayTs + 86400_000;

    const todayIncome = income.filter(
      (r) => r.at >= todayTs && r.at < todayEnd,
    );
    const todayExpenses = expenses.filter(
      (r) => r.at >= todayTs && r.at < todayEnd,
    );
    const todayOrders = completedOrders.filter(
      (o) => o.timestamp >= todayTs && o.timestamp < todayEnd,
    );

    const totalIncome = todayIncome.reduce((s, r) => s + r.amount, 0);
    const totalExpenses = todayExpenses.reduce((s, r) => s + r.amount, 0);
    const totalTax = todayOrders.reduce((s, o) => s + o.cgst + o.sgst, 0);

    const byPayment = todayIncome.reduce<Record<string, number>>((acc, r) => {
      acc[r.mode] = (acc[r.mode] ?? 0) + r.amount;
      return acc;
    }, {});

    const byExpenseCategory = todayExpenses.reduce<Record<string, number>>(
      (acc, r) => {
        acc[r.category] = (acc[r.category] ?? 0) + r.amount;
        return acc;
      },
      {},
    );

    return {
      date: today,
      covers: todayOrders.length,
      totalIncome,
      totalExpenses,
      netCash: totalIncome - totalExpenses,
      totalTax,
      byPayment,
      byExpenseCategory,
    };
  }, [income, expenses, completedOrders, today]);

  if (!can("view_reports")) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <SunMedium className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-gray-900">End-of-Day Summary</span>
          <span className="text-xs text-gray-400">{today}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard label="Covers" value={String(report.covers)} />
            <MetricCard label="Gross Income" value={formatCurrency(report.totalIncome)} accent="emerald" />
            <MetricCard label="Total Tax" value={formatCurrency(report.totalTax)} accent="blue" />
            <MetricCard
              label="Net Cash"
              value={formatCurrency(report.netCash)}
              accent={report.netCash >= 0 ? "emerald" : "red"}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BreakdownTable
              title="Income by Payment Mode"
              rows={Object.entries(report.byPayment)}
            />
            <BreakdownTable
              title="Expenses by Category"
              rows={Object.entries(report.byExpenseCategory)}
            />
          </div>

          <button
            type="button"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" />
            Print / Download
          </button>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  accent = "gray",
}: {
  label: string;
  value: string;
  accent?: "emerald" | "red" | "blue" | "gray";
}) {
  const colorMap = {
    emerald: "text-emerald-700",
    red: "text-red-600",
    blue: "text-blue-700",
    gray: "text-gray-900",
  };
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-extrabold tabular-nums ${colorMap[accent]}`}>
        {value}
      </div>
    </div>
  );
}

function BreakdownTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <div className="mb-2 text-xs font-bold text-gray-500">{title}</div>
        <p className="text-xs text-gray-400">No data for today.</p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-bold text-gray-500">{title}</div>
      <table className="w-full text-xs">
        <tbody className="divide-y divide-gray-100">
          {rows.map(([label, amount]) => (
            <tr key={label}>
              <td className="py-1 text-gray-700">{label}</td>
              <td className="py-1 text-right font-semibold tabular-nums text-gray-900">
                ₹{amount.toLocaleString("en-IN")}
              </td>
            </tr>
          ))}
          <tr className="border-t border-gray-200 font-bold">
            <td className="py-1 text-gray-800">Total</td>
            <td className="py-1 text-right tabular-nums text-gray-900">
              ₹{rows.reduce((s, [, v]) => s + v, 0).toLocaleString("en-IN")}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
