import { useMemo, useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Calendar,
  Download,
  Printer,
  X,
  RefreshCcw,
  CheckCircle2,
  Ban,
  Receipt,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Truck,
  Users,
  ShoppingBag,
  Car,
  ArrowDownToLine,
  Clock,
  AlertTriangle,
  History,
  User,
  Utensils,
  HandCoins,
  Hourglass,
  Radio,
} from "lucide-react";
import {
  SEED_ORDERS,
  formatDateTime,
  formatINR,
  formatTime,
  isoDate,
  type ArchiveLine,
  type ArchiveOrder,
  type ArchivePayment,
  type ArchiveStatus,
  type AuditEvent,
} from "@/lib/ordersData";
import type { OrderType } from "@/types";
import type { ModuleId } from "@/lib/modules";
import {
  useFOH,
  type CompletedOrder,
  type OrderMeta,
  type PaymentMethod,
} from "@/context/FOHContext";
import { useAccounts } from "@/context/AccountsContext";
import { useCRM } from "@/context/CRMContext";
import { useKDS } from "@/context/KDSContext";
import { SEED_RULES } from "@/lib/crmData";
import { lineUnitPrice, modifierLabels, type CartLine } from "@/lib/cart";
import { SettleModal } from "./foh/SettleModal";
import { commitSettlement } from "@/lib/transactionsApi";
import { useCollectionState } from "@/lib/collectionState";
import { commitRefund } from "@/lib/workflowsApi";

const STATUS_FILTERS: ("All" | ArchiveStatus)[] = [
  "All",
  "Settled",
  "Voided",
  "Refunded",
];

const TYPE_FILTERS: ("All" | OrderType)[] = [
  "All",
  "Dine In",
  "Takeaway",
  "Delivery",
  "Drive Thru",
];

const PAYMENT_ICON: Record<ArchivePayment, typeof Banknote> = {
  Cash: Banknote,
  Card: CreditCard,
  UPI: Smartphone,
  Wallet: Wallet,
};

const TYPE_ICON: Record<OrderType, typeof ShoppingBag> = {
  "Dine In": Users,
  Takeaway: ShoppingBag,
  Delivery: Truck,
  "Drive Thru": Car,
};

const STATUS_BADGE: Record<ArchiveStatus, string> = {
  Settled: "bg-emerald-600 text-white",
  Voided:
    "border border-dashed border-red-400 text-red-600 bg-red-50",
  Refunded: "bg-gray-200 text-gray-700",
};

const AUDIT_TONE: Record<AuditEvent["kind"], string> = {
  Ordered: "bg-gray-300",
  "KOT Sent": "bg-amber-400",
  Ready: "bg-emerald-400",
  Served: "bg-blue-400",
  Settled: "bg-emerald-600",
  Voided: "bg-red-500",
  Refunded: "bg-gray-500",
};

const PAY_MAP: Record<PaymentMethod, ArchivePayment> = {
  Cash: "Cash",
  Card: "Card",
  UPI: "UPI",
  Wallet: "Wallet",
};

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

/** A live, not-yet-closed session shown in the Ongoing Active Bills area. */
interface OngoingBill {
  tableId: string;
  meta: OrderMeta;
  lines: CartLine[];
  itemCount: number;
  total: number;
  phase: "eating" | "settlement";
  since: number;
}

/** Map an in-session completed order onto the archive shape for display. */
function completedToArchive(o: CompletedOrder): ArchiveOrder {
  const lines: ArchiveLine[] = o.lines.map((l) => ({
    name: l.item.name,
    quantity: l.quantity,
    unitPrice: lineUnitPrice(l),
    modifiers: modifierLabels(l),
  }));
  return {
    id: o.id.replace(/^txn-/, "SRV-"),
    timestamp: o.timestamp,
    source:
      o.meta.orderType === "Dine In"
        ? `Table ${o.meta.tableId.replace(/^T-/, "")}`
        : o.meta.orderSource,
    orderType: o.meta.orderType,
    customerName: o.meta.customerName || undefined,
    waiterName: o.meta.waiterName,
    lines,
    subtotal: o.subtotal,
    discount: o.discount,
    cgst: o.cgst,
    sgst: o.sgst,
    total: o.total,
    payment: PAY_MAP[o.paymentMethod],
    status: "Settled",
    audit: [
      { kind: "Ordered", at: o.timestamp - 60_000, by: o.meta.waiterName },
      { kind: "Settled", at: o.timestamp, by: o.meta.waiterName },
    ],
  };
}

export function OrdersManagement({
  onNavigate,
}: {
  onNavigate?: (module: ModuleId) => void;
}) {
  const {
    heldCarts,
    heldMeta,
    pendingBills,
    completedOrders,
    tables,
    recallToWorkspace,
    settleOngoing,
  } = useFOH();
  const { postIncome } = useAccounts();
  const { recordVisit, addFeedback } = useCRM();
  const { closeTable } = useKDS();

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | ArchiveStatus>(
    "All",
  );
  const [typeFilter, setTypeFilter] = useState<"All" | OrderType>("All");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [refundFor, setRefundFor] = useState<ArchiveOrder | null>(null);
  const [refundOverrides, setRefundOverrides] = useCollectionState<
    Record<string, { reason: string; at: number }>
  >("order_refunds", {});
  const [settleTarget, setSettleTarget] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3000,
    );
  };

  /* ---------- Live: ongoing active bills ---------- */

  const ongoing = useMemo<OngoingBill[]>(() => {
    const rows: OngoingBill[] = [];
    for (const [tid, bill] of Object.entries(pendingBills)) {
      rows.push({
        tableId: tid,
        meta: bill.meta,
        lines: bill.lines,
        itemCount: bill.lines.reduce((n, l) => n + l.quantity, 0),
        total: bill.total,
        phase: "settlement",
        since: bill.generatedAt,
      });
    }
    for (const [tid, lines] of Object.entries(heldCarts)) {
      if (pendingBills[tid]) continue;
      if (!lines || lines.length === 0) continue;
      const subtotal = lines.reduce(
        (s, l) => s + lineUnitPrice(l) * l.quantity,
        0,
      );
      const cgst = Math.round(subtotal * 0.025);
      const sgst = Math.round(subtotal * 0.025);
      rows.push({
        tableId: tid,
        meta: heldMeta[tid] ?? {
          orderType: "Dine In",
          tableId: tid,
          pax: 0,
          customerName: "",
          customerPhone: "",
          waiterName: "Unassigned",
          orderSource: "Walk-In",
        },
        lines,
        itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        total: subtotal + cgst + sgst,
        phase: "eating",
        since: tables.find((t) => t.id === tid)?.occupiedSince ?? 0,
      });
    }
    return rows.sort((a, b) =>
      a.tableId.localeCompare(b.tableId, undefined, { numeric: true }),
    );
  }, [pendingBills, heldCarts, heldMeta, tables]);

  const liveTotals = useMemo(() => {
    let running = 0;
    let awaiting = 0;
    for (const b of ongoing) {
      if (b.phase === "settlement") awaiting += b.total;
      else running += b.total;
    }
    return { running, awaiting };
  }, [ongoing]);

  /* ---------- Archive: completed transactions ---------- */

  const allOrders = useMemo<ArchiveOrder[]>(() => {
    const merged: ArchiveOrder[] = [
      ...completedOrders.map(completedToArchive),
      ...SEED_ORDERS,
    ];
    return merged.map((o) => {
      const ov = refundOverrides[o.id];
      if (ov && o.status === "Settled") {
        return {
          ...o,
          status: "Refunded" as ArchiveStatus,
          refundReason: ov.reason,
          refundedAt: ov.at,
          audit: [
            ...o.audit,
            { kind: "Refunded", at: ov.at, by: "Manager", note: ov.reason },
          ],
        };
      }
      return o;
    });
  }, [completedOrders, refundOverrides]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;
    return allOrders
      .filter((o) => {
        if (statusFilter !== "All" && o.status !== statusFilter) return false;
        if (typeFilter !== "All" && o.orderType !== typeFilter) return false;
        if (fromMs !== null && o.timestamp < fromMs) return false;
        if (toMs !== null && o.timestamp > toMs) return false;
        if (
          q &&
          !o.id.toLowerCase().includes(q) &&
          !(o.customerName ?? "").toLowerCase().includes(q) &&
          !o.source.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [allOrders, query, statusFilter, typeFilter, fromDate, toDate]);

  const summary = useMemo(() => {
    let settled = 0;
    let voided = 0;
    let refunded = 0;
    let revenue = 0;
    for (const o of visible) {
      if (o.status === "Settled") {
        settled++;
        revenue += o.total;
      } else if (o.status === "Voided") {
        voided++;
      } else {
        refunded++;
      }
    }
    return { settled, voided, refunded, revenue, count: visible.length };
  }, [visible]);

  const openOrder = allOrders.find((o) => o.id === openId) ?? null;
  const settleBill = ongoing.find((b) => b.tableId === settleTarget) ?? null;

  /* ---------- Actions ---------- */

  // Supervisor bill recall: push the session context back into the FOH server
  // workspace so items/discounts can be appended before final closure.
  const handleRecall = (tableId: string) => {
    recallToWorkspace(tableId);
    pushToast(`Bill for ${tableId} pulled to FOH workspace`, "info");
    onNavigate?.("foh");
  };

  // Explicit final billing handshake: lock the counters, log the payment, and
  // fire the transaction straight into the continuous Accounts stream.
  const handleCloseBill = async (
    method: PaymentMethod,
    tendered: number,
    change: number,
    feedback: { rating: number; comment: string },
  ) => {
    if (!settleBill) return;
    const bill = settleBill;
    const tid = bill.tableId;
    const txn = settleOngoing(tid, {
      method,
      amountTendered: method === "Cash" ? tendered : undefined,
      changeReturned: method === "Cash" ? change : undefined,
    });
    if (!txn) {
      setSettleTarget(null);
      pushToast(`Nothing to close for ${tid}`, "warn");
      return;
    }
    let committed: { invoiceNumber: string; ledgerId: string; auditId: string };
    try {
      committed = await commitSettlement(txn, "Cashier");
    } catch {
      pushToast(`Could not commit settlement for ${tid}`, "warn");
      return;
    }
    // Session paid â€” clear this table's tickets off the KDS.
    closeTable(tid);
    // Fire the actually-committed transaction (txn), not the pre-settlement
    // snapshot, straight into the income (debit) ledger.
    postIncome({
      at: Date.now(),
      table: tid,
      amount: txn.total,
      mode: method,
      server: txn.meta.waiterName,
      id: committed.ledgerId,
    });
    if (txn.meta.customerPhone) {
      recordVisit(
        txn.meta.customerPhone,
        txn.total,
        Math.round(txn.total * SEED_RULES.pointsPerRupee),
      );
      if (feedback.rating > 0) {
        addFeedback(txn.meta.customerPhone, {
          rating: feedback.rating,
          visitDate: new Date().toISOString().slice(0, 10),
          comment: feedback.comment,
        });
      }
    }
    setSettleTarget(null);
    pushToast(
      `Bill closed Â· ${tid} Â· ${formatINR(txn.total)} via ${method}`,
      "success",
    );
  };

  const handleRefund = (order: ArchiveOrder, reason: string) => {
    const at = Date.now();
    setRefundOverrides((m) => ({
      ...m,
      [order.id]: { reason, at },
    }));
    void commitRefund(order.id, reason);
    setRefundFor(null);
    pushToast(`Refund issued for ${order.id}`, "success");
  };

  const handleExportCSV = () => {
    const header = [
      "Order ID",
      "Timestamp",
      "Source",
      "Order Type",
      "Customer",
      "Waiter",
      "Subtotal",
      "Discount",
      "CGST",
      "SGST",
      "Total",
      "Payment",
      "Status",
      "Reason",
    ];
    const rows = visible.map((o) => [
      o.id,
      new Date(o.timestamp).toISOString(),
      o.source,
      o.orderType,
      o.customerName ?? "",
      o.waiterName,
      o.subtotal.toFixed(2),
      o.discount.toFixed(2),
      o.cgst.toFixed(2),
      o.sgst.toFixed(2),
      o.total.toFixed(2),
      o.payment,
      o.status,
      o.voidReason ?? o.refundReason ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `servaa-orders-${isoDate(Date.now())}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Exported ${visible.length} orders to CSV`, "info");
  };

  const handlePrintReport = () => {
    window.print();
    pushToast("Print dialog opened", "info");
  };

  const clearDates = () => {
    setFromDate("");
    setToDate("");
  };

  return (
    <div className="space-y-6">
      {/* ============ ONGOING ACTIVE BILLS ============ */}
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: "var(--primary-orange)" }}
              />
            </span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
              Ongoing Active Bills
            </h2>
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-700">
              {ongoing.length}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <Utensils className="h-3.5 w-3.5 text-amber-500" />
              Running:{" "}
              <strong className="text-gray-800">
                {formatINR(liveTotals.running)}
              </strong>
            </span>
            <span className="text-gray-300">Â·</span>
            <span className="inline-flex items-center gap-1">
              <Hourglass className="h-3.5 w-3.5 text-blue-500" />
              Awaiting:{" "}
              <strong className="text-gray-800">
                {formatINR(liveTotals.awaiting)}
              </strong>
            </span>
          </div>
        </div>

        {ongoing.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-8 text-center">
            <Radio className="mx-auto h-6 w-6 text-gray-300" />
            <p className="mt-2 text-sm font-semibold text-gray-500">
              No active bills right now
            </p>
            <p className="mt-0.5 text-xs text-gray-400">
              Open a table in Front of House to start a live session â€” it will
              appear here in real time.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ongoing.map((b) => (
              <OngoingCard
                key={b.tableId}
                bill={b}
                onRecall={() => handleRecall(b.tableId)}
                onClose={() => setSettleTarget(b.tableId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ============ COMPLETED TRANSACTIONS ============ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
            Completed Transactions
          </h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
            {allOrders.length}
          </span>
        </div>

        {/* Top filter bar */}
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[260px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Order ID, Customer or Sourceâ€¦"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-1.5">
              <Calendar className="ml-1 h-4 w-4 text-gray-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-md border-0 bg-transparent px-1 py-1 text-sm text-gray-700 focus:outline-none"
              />
              <span className="text-xs text-gray-400">â†’</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-md border-0 bg-transparent px-1 py-1 text-sm text-gray-700 focus:outline-none"
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={clearDates}
                  className="ml-1 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear date range"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 shadow-sm hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
              >
                <Download className="h-3.5 w-3.5" />
                Download CSV
              </button>
              <button
                type="button"
                onClick={handlePrintReport}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Printer className="h-3.5 w-3.5" />
                Print Report
              </button>
            </div>
          </div>

          {/* Pills row */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
              {STATUS_FILTERS.map((s) => {
                const isActive = s === statusFilter;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`relative rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                      isActive
                        ? "text-white"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="orders-status-pill"
                        className="absolute inset-0 rounded-md shadow-sm"
                        style={{ backgroundColor: "var(--primary-orange)" }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 32,
                        }}
                      />
                    )}
                    <span className="relative z-10">{s}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
              {TYPE_FILTERS.map((t) => {
                const isActive = t === typeFilter;
                const Icon = t === "All" ? null : TYPE_ICON[t as OrderType];
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      isActive
                        ? "bg-gray-900 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {Icon && <Icon className="h-3.5 w-3.5" />}
                    {t}
                  </button>
                );
              })}
            </div>
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
              <span>
                <strong className="text-gray-900">{summary.count}</strong> orders
              </span>
              <span className="text-gray-300">Â·</span>
              <span>
                Revenue:{" "}
                <strong className="text-emerald-700">
                  {formatINR(summary.revenue)}
                </strong>
              </span>
              <span className="text-gray-300">Â·</span>
              <span>
                <strong className="text-red-600">{summary.voided}</strong> voided
              </span>
              <span className="text-gray-300">Â·</span>
              <span>
                <strong className="text-gray-700">{summary.refunded}</strong>{" "}
                refunded
              </span>
            </div>
          </div>
        </div>

        {/* Audit Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Order ID</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-sm text-gray-400"
                    >
                      No orders match those filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((o) => {
                    const TypeIcon = TYPE_ICON[o.orderType];
                    const PayIcon = PAYMENT_ICON[o.payment];
                    return (
                      <tr
                        key={o.id}
                        onClick={() => setOpenId(o.id)}
                        className={`cursor-pointer transition ${
                          o.status === "Voided"
                            ? "bg-red-50/40 hover:bg-red-50/70"
                            : o.status === "Refunded"
                              ? "bg-gray-50/60 hover:bg-gray-100/60"
                              : "hover:bg-orange-50/40"
                        }`}
                      >
                        <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                          {formatDateTime(o.timestamp)}
                        </td>
                        <td className="px-4 py-3 font-mono text-[13px] font-bold text-gray-900">
                          #{o.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5">
                            <TypeIcon className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-700">
                              {o.source}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-gray-400">
                            {o.orderType}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-gray-700">
                            {o.customerName ?? (
                              <span className="text-gray-300">â€”</span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {o.waiterName}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-bold tabular-nums text-gray-900">
                          {formatINR(o.total)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                            <PayIcon className="h-3.5 w-3.5 text-gray-400" />
                            {o.payment}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[o.status]}`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenId(o.id);
                            }}
                            className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Close-bill settle modal (final billing handshake) */}
      <SettleModal
        open={settleTarget !== null && settleBill !== null}
        total={settleBill?.total ?? 0}
        title={`Close Bill Â· ${settleTarget ?? ""}`}
        subtitle={
          settleBill
            ? `${settleBill.meta.customerName || "Guest"} Â· ${settleBill.itemCount} items`
            : undefined
        }
        onClose={() => setSettleTarget(null)}
        onPaid={handleCloseBill}
      />

      {/* Receipt drawer */}
      <AnimatePresence>
        {openOrder && (
          <ReceiptDrawer
            key={openOrder.id}
            order={openOrder}
            onClose={() => setOpenId(null)}
            onRefund={(o) => setRefundFor(o)}
          />
        )}
      </AnimatePresence>

      {/* Refund modal */}
      <AnimatePresence>
        {refundFor && (
          <RefundModal
            key={refundFor.id}
            order={refundFor}
            onClose={() => setRefundFor(null)}
            onConfirm={(reason) => handleRefund(refundFor, reason)}
          />
        )}
      </AnimatePresence>

      {/* Toasts */}
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

/* ---------- Ongoing Bill Card ---------- */

function OngoingCard({
  bill,
  onRecall,
  onClose,
}: {
  bill: OngoingBill;
  onRecall: () => void;
  onClose: () => void;
}) {
  const settlement = bill.phase === "settlement";
  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
        settlement
          ? "border-blue-200 ring-1 ring-blue-100"
          : "border-amber-200 ring-1 ring-amber-100"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-extrabold text-gray-900">
              {bill.tableId}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                settlement
                  ? "bg-blue-100 text-blue-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {settlement ? (
                <>
                  <Hourglass className="h-3 w-3" />
                  Awaiting Settlement
                </>
              ) : (
                <>
                  <Utensils className="h-3 w-3" />
                  Eating
                </>
              )}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            {bill.meta.customerName || "Walk-in"} Â· {bill.meta.waiterName}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-extrabold tabular-nums text-gray-900">
            {formatINR(bill.total)}
          </div>
          <div className="text-[11px] text-gray-400">
            {bill.itemCount} item{bill.itemCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>

      {bill.since > 0 && (
        <div className="mt-2 inline-flex items-center gap-1 text-[11px] text-gray-400">
          <Clock className="h-3 w-3" />
          {settlement ? "Bill generated" : "Seated"} {formatTime(bill.since)}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onRecall}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 px-3 py-2 text-xs font-bold uppercase tracking-wide transition hover:bg-orange-50"
          style={{
            borderColor: "var(--primary-orange)",
            color: "var(--primary-orange)",
          }}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Pull Bill / Modify
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-emerald-700"
        >
          <HandCoins className="h-3.5 w-3.5" />
          Close Bill
        </button>
      </div>
    </div>
  );
}

/* ---------- Receipt Drawer ---------- */

function ReceiptDrawer({
  order,
  onClose,
  onRefund,
}: {
  order: ArchiveOrder;
  onClose: () => void;
  onRefund: (o: ArchiveOrder) => void;
}) {
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const PayIcon = PAYMENT_ICON[order.payment];
  const TypeIcon = TYPE_ICON[order.orderType];

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-orange-600">
              <Receipt className="h-3.5 w-3.5" />
              Digital Receipt
            </div>
            <h2 className="mt-0.5 font-mono text-lg font-extrabold text-gray-900">
              #{order.id}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span>{formatDateTime(order.timestamp)}</span>
              <span className="text-gray-300">Â·</span>
              <span className="inline-flex items-center gap-1">
                <TypeIcon className="h-3 w-3" />
                {order.source}
              </span>
              <span className="text-gray-300">Â·</span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3 w-3" />
                {order.waiterName}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[order.status]}`}
            >
              {order.status}
            </span>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Void/refund banner */}
          {order.status === "Voided" && order.voidReason && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                  Reason for Void
                </div>
                <div className="mt-0.5 text-sm font-semibold text-red-700">
                  {order.voidReason}
                </div>
              </div>
            </div>
          )}
          {order.status === "Refunded" && order.refundReason && (
            <div className="flex items-start gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3">
              <RefreshCcw className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Refund Reason
                </div>
                <div className="mt-0.5 text-sm font-semibold text-gray-700">
                  {order.refundReason}
                </div>
              </div>
            </div>
          )}

          {/* Customer */}
          {order.customerName && (
            <section className="rounded-lg border border-gray-200 bg-gray-50/60 p-3 text-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Customer
              </div>
              <div className="mt-0.5 font-semibold text-gray-900">
                {order.customerName}
              </div>
            </section>
          )}

          {/* Items */}
          <section>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Itemised
            </div>
            <ul className="divide-y divide-dashed divide-gray-200 rounded-lg border border-gray-200">
              {order.lines.map((l, idx) => (
                <li
                  key={`${l.name}-${idx}`}
                  className="flex items-start justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500">
                        Ã—{l.quantity}
                      </span>
                      <span className="font-semibold text-gray-900">
                        {l.name}
                      </span>
                    </div>
                    {l.modifiers.length > 0 && (
                      <div
                        className="mt-0.5 pl-6 text-[11px] font-bold uppercase leading-snug tracking-wide"
                        style={{ color: "var(--primary-orange)" }}
                      >
                        â†³ {l.modifiers.join(" Â· ")}
                      </div>
                    )}
                    <div className="mt-0.5 pl-6 text-[11px] text-gray-400">
                      {formatINR(l.unitPrice)} each
                    </div>
                  </div>
                  <div className="font-bold tabular-nums text-gray-900">
                    {formatINR(l.unitPrice * l.quantity)}
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Totals */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 text-sm">
            <Row label="Subtotal" value={formatINR(order.subtotal)} />
            {order.discount > 0 && (
              <Row
                label="Discount"
                value={`âˆ’ ${formatINR(order.discount)}`}
                tone="green"
              />
            )}
            <Row label="CGST (2.5%)" value={formatINR(order.cgst)} muted />
            <Row label="SGST (2.5%)" value={formatINR(order.sgst)} muted />
            <div className="my-2 border-t border-dashed border-gray-200" />
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold uppercase tracking-wider text-gray-700">
                Grand Total
              </span>
              <span className="text-xl font-extrabold tabular-nums text-gray-900">
                {formatINR(order.total)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-xs">
              <span className="font-semibold text-gray-500">Paid via</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-gray-800">
                <PayIcon className="h-3.5 w-3.5" />
                {order.payment}
              </span>
            </div>
          </section>

          {/* Audit Timeline */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <History className="h-3.5 w-3.5" />
              Audit Timeline
            </div>
            <ol className="relative ml-2 border-l border-gray-200 pl-4">
              {order.audit.map((ev, i) => (
                <li key={i} className="relative pb-3 last:pb-0">
                  <span
                    className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${AUDIT_TONE[ev.kind]}`}
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold text-gray-900">
                      {ev.kind}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                      <Clock className="h-3 w-3" />
                      {formatTime(ev.at)}
                    </span>
                    {ev.by && (
                      <span className="text-[11px] text-gray-400">
                        by {ev.by}
                      </span>
                    )}
                  </div>
                  {ev.note && (
                    <div className="mt-0.5 text-[11px] italic text-gray-500">
                      â€œ{ev.note}â€
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-gray-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-700 hover:bg-gray-50"
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </button>
          {order.status === "Settled" ? (
            <button
              type="button"
              onClick={() => onRefund(order)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-red-700"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Issue Refund
            </button>
          ) : order.status === "Refunded" ? (
            <div className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-gray-200 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-700">
              <ArrowDownToLine className="h-3.5 w-3.5" />
              Already Refunded
            </div>
          ) : (
            <div className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-red-600">
              <Ban className="h-3.5 w-3.5" />
              Order Voided
            </div>
          )}
        </footer>
      </motion.aside>
    </>
  );
}

/* ---------- Refund Modal ---------- */

function RefundModal({
  order,
  onClose,
  onConfirm,
}: {
  order: ArchiveOrder;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const PRESETS = [
    "Customer complaint",
    "Wrong item delivered",
    "Quality issue",
    "Late delivery",
    "Duplicate charge",
  ];

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
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-red-600">
                Issue Refund
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                #{order.id} Â· {formatINR(order.total)}
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
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Refunds are logged on the audit trail and cannot be undone.
            </div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Reason (required)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Explain why this order is being refundedâ€¦"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-300 focus:outline-none focus:ring-2 focus:ring-red-100"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className="rounded-full border border-gray-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700"
                >
                  {p}
                </button>
              ))}
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
              disabled={reason.trim().length < 3}
              onClick={() => onConfirm(reason.trim())}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCircle2 className="h-4 w-4" />
              Confirm Refund
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ---------- Helpers ---------- */

function Row({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "green";
}) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className={muted ? "text-gray-500" : "text-gray-700"}>{label}</span>
      <span
        className={`font-semibold tabular-nums ${
          tone === "green"
            ? "text-emerald-700"
            : muted
              ? "text-gray-500"
              : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
