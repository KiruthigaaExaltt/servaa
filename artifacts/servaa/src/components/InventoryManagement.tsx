import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Package,
  AlertTriangle,
  XCircle,
  IndianRupee,
  Search,
  Plus,
  Pencil,
  Send,
  X,
  Phone,
  Truck,
  CalendarDays,
  Filter,
  PackageCheck,
  FileText,
  ChefHat,
  Hash,
  ArrowDownRight,
} from "lucide-react";
import {
  formatRelativeDate,
  statusOf,
  type InventoryCategory,
  type InventoryItem,
  type StockStatus,
} from "@/lib/inventoryData";
import {
  PREP_RECIPES,
  PREP_STAFF,
  computePrepDraw,
  grnValue,
  type GRNBatch,
  type PrepBatchLog,
  type PrepConsumption,
} from "@/lib/grn";
import { useInventory, type LogPrepResult } from "@/context/InventoryContext";

const ALL_CATEGORIES: ("All" | InventoryCategory)[] = [
  "All",
  "Grains",
  "Dairy",
  "Meat",
  "Seafood",
  "Produce",
  "Spices",
  "Beverages",
  "Bakery",
  "Oils",
];

const STATUS_FILTERS: ("All" | StockStatus)[] = [
  "All",
  "In Stock",
  "Low",
  "Out",
];

const STATUS_BADGE: Record<StockStatus, string> = {
  "In Stock": "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200",
  Low: "bg-amber-100 text-amber-800 ring-1 ring-amber-200",
  Out: "bg-red-100 text-red-700 ring-1 ring-red-200",
};

const CATEGORY_TONE: Record<InventoryCategory, string> = {
  Grains: "bg-amber-50 text-amber-700 border-amber-200",
  Dairy: "bg-sky-50 text-sky-700 border-sky-200",
  Meat: "bg-red-50 text-red-700 border-red-200",
  Seafood: "bg-cyan-50 text-cyan-700 border-cyan-200",
  Produce: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Spices: "bg-orange-50 text-orange-700 border-orange-200",
  Beverages: "bg-blue-50 text-blue-700 border-blue-200",
  Bakery: "bg-yellow-50 text-yellow-700 border-yellow-200",
  Oils: "bg-lime-50 text-lime-700 border-lime-200",
};

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

type InventoryView = "stock" | "grn" | "prep";

const SUB_TABS: { id: InventoryView; label: string; icon: React.ReactNode }[] = [
  { id: "stock", label: "Stock Items", icon: <Package className="h-4 w-4" /> },
  {
    id: "grn",
    label: "Goods Received",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "prep",
    label: "Recipe Prep",
    icon: <ChefHat className="h-4 w-4" />,
  },
];

export function InventoryManagement() {
  const { items, grnBatches, prepLogs, updateItem, receiveGRN, logPrep } = useInventory();
  const [view, setView] = useState<InventoryView>("stock");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | InventoryCategory>("All");
  const [statusFilter, setStatusFilter] = useState<"All" | StockStatus>("All");
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3000,
    );
  };

  // KPIs
  const kpis = useMemo(() => {
    let low = 0;
    let out = 0;
    let value = 0;
    for (const it of items) {
      const s = statusOf(it);
      if (s === "Low") low++;
      if (s === "Out") out++;
      value += it.stock * it.unitPrice;
    }
    return { total: items.length, low, out, value };
  }, [items]);

  // Filtering
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== "All" && it.category !== category) return false;
      if (statusFilter !== "All" && statusOf(it) !== statusFilter) return false;
      if (
        q &&
        !it.name.toLowerCase().includes(q) &&
        !it.supplierName.toLowerCase().includes(q) &&
        !it.category.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, query, category, statusFilter]);

  const handleSave = (
    id: string,
    patch: {
      addStock: number;
      newPrice: number;
      supplierName: string;
      supplierContact: string;
    },
  ) => {
    updateItem(id, patch);
    pushToast(
      patch.addStock > 0
        ? `Added ${patch.addStock} to stock`
        : "Item details updated",
      "success",
    );
    setEditing(null);
  };

  const handleReceiveGRN = (entry: {
    inventoryId: string;
    batchNumber: string;
    qtyReceived: number;
    unitCost: number;
  }) => {
    const item = items.find((i) => i.id === entry.inventoryId);
    if (!item) return;
    receiveGRN(entry);
    pushToast(
      `Received ${entry.qtyReceived} ${item.unit} of ${item.name} · posted to Accounts`,
      "success",
    );
  };

  const handleLogPrep = (entry: {
    recipeId: string;
    yieldQty: number;
    preparedBy: string;
  }): LogPrepResult => {
    const result = logPrep(entry);
    if (result.ok) {
      const cost = result.batchCost ?? 0;
      pushToast(
        `Batch logged · ₹${Math.round(cost).toLocaleString("en-IN")} raw material cost posted to Accounts`,
        "success",
      );
    }
    return result;
  };

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Package className="h-5 w-5" />}
          label="Total Items"
          value={kpis.total.toString()}
          tone="slate"
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Low Stock Alerts"
          value={kpis.low.toString()}
          tone={kpis.low > 0 ? "red" : "slate"}
          subtle={kpis.low > 0 ? "Below minimum level" : "All healthy"}
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5" />}
          label="Out of Stock"
          value={kpis.out.toString()}
          tone={kpis.out > 0 ? "red" : "slate"}
          subtle={kpis.out > 0 ? "Reorder immediately" : "Nothing critical"}
        />
        <KpiCard
          icon={<IndianRupee className="h-5 w-5" />}
          label="Total Inventory Value"
          value={`₹${Math.round(kpis.value).toLocaleString("en-IN")}`}
          tone="orange"
          subtle="Stock × Unit Price"
        />
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {SUB_TABS.map((tab) => {
          const isActive = tab.id === view;
          const badge =
            tab.id === "grn"
              ? grnBatches.length
              : tab.id === "prep"
                ? prepLogs.length
                : undefined;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`relative inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "text-gray-900"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <span className={isActive ? "text-orange-600" : ""}>
                {tab.icon}
              </span>
              {tab.label}
              {badge !== undefined && badge > 0 && (
                <span
                  className={`ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                    isActive
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="inventory-subtab-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 rounded-full"
                  style={{ backgroundColor: "var(--primary-orange)" }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* ---------- Stock Items view ---------- */}
      {view === "stock" && (
        <>
          {/* Filters bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by item, category or supplier…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="hidden items-center gap-1 text-xs font-semibold text-gray-500 sm:flex">
                <Filter className="h-3.5 w-3.5" /> Status
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
                {STATUS_FILTERS.map((s) => {
                  const isActive = s === statusFilter;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as "All" | InventoryCategory)
                }
                className="rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-gray-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {ALL_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All Categories" : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-right">Current Stock</th>
                    <th className="px-4 py-3 text-right">Min Level</th>
                    <th className="px-4 py-3">Last Restocked</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="px-4 py-12 text-center text-sm text-gray-400"
                      >
                        No inventory items match those filters.
                      </td>
                    </tr>
                  ) : (
                    visible.map((it) => {
                      const s = statusOf(it);
                      return (
                        <tr
                          key={it.id}
                          className={`transition ${
                            s === "Out"
                              ? "bg-red-50/60 hover:bg-red-50"
                              : s === "Low"
                                ? "bg-red-50/30 hover:bg-red-50/60"
                                : "hover:bg-gray-50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">
                              {it.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              ₹{it.unitPrice}/{it.unit}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_TONE[it.category]}`}
                            >
                              {it.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                            {it.stock}{" "}
                            <span className="text-xs font-medium text-gray-400">
                              {it.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-gray-500">
                            {it.minLevel}{" "}
                            <span className="text-xs text-gray-400">
                              {it.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="inline-flex items-center gap-1 text-xs text-gray-600">
                              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                              {formatRelativeDate(it.lastRestocked)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-gray-700">
                              {it.supplierName}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {it.supplierContact}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${STATUS_BADGE[s]}`}
                            >
                              {s}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setEditing(it)}
                                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
                                style={{
                                  backgroundColor: "var(--primary-orange)",
                                }}
                              >
                                <Pencil className="h-3 w-3" />
                                Update
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---------- Goods Received (GRN) view ---------- */}
      {view === "grn" && (
        <GRNView
          items={items}
          batches={grnBatches}
          onReceive={handleReceiveGRN}
        />
      )}

      {/* ---------- Recipe Prep view ---------- */}
      {view === "prep" && (
        <PrepView items={items} logs={prepLogs} onLogPrep={handleLogPrep} />
      )}

      {/* Update Stock side panel */}
      <AnimatePresence>
        {editing && (
          <UpdateStockPanel
            key={editing.id}
            item={editing}
            onClose={() => setEditing(null)}
            onSave={handleSave}
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

/* ---------- Goods Received Note (GRN) view ---------- */

function GRNView({
  items,
  batches,
  onReceive,
}: {
  items: InventoryItem[];
  batches: GRNBatch[];
  onReceive: (entry: {
    inventoryId: string;
    batchNumber: string;
    qtyReceived: number;
    unitCost: number;
  }) => void;
}) {
  const [inventoryId, setInventoryId] = useState<string>(items[0]?.id ?? "");
  const [batchNumber, setBatchNumber] = useState("");
  const [qtyReceived, setQtyReceived] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(items[0]?.unitPrice ?? 0);

  const selected = items.find((i) => i.id === inventoryId);

  const onPickItem = (id: string) => {
    setInventoryId(id);
    const it = items.find((i) => i.id === id);
    if (it) setUnitCost(it.unitPrice);
  };

  const canSubmit =
    !!selected &&
    batchNumber.trim().length > 0 &&
    qtyReceived > 0 &&
    unitCost > 0;

  const submit = () => {
    if (!canSubmit || !selected) return;
    onReceive({
      inventoryId: selected.id,
      batchNumber: batchNumber.trim(),
      qtyReceived,
      unitCost,
    });
    setBatchNumber("");
    setQtyReceived(0);
  };

  const totalReceivedValue = batches.reduce((s, b) => s + grnValue(b), 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* Intake form */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-gray-900">
                Goods Received Note
              </div>
              <div className="text-xs text-gray-500">
                Log an incoming batch to top up live stock.
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Item
              </label>
              <select
                value={inventoryId}
                onChange={(e) => onPickItem(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.name} ({it.stock} {it.unit} in stock)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Batch Number
              </label>
              <div className="relative">
                <Hash className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={batchNumber}
                  onChange={(e) => setBatchNumber(e.target.value)}
                  placeholder="e.g. BR-2407"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Qty Received {selected ? `(${selected.unit})` : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={qtyReceived || ""}
                  onChange={(e) =>
                    setQtyReceived(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Unit Cost (₹)
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={unitCost || ""}
                    onChange={(e) =>
                      setUnitCost(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-7 pr-3 text-sm font-semibold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              </div>
            </div>

            {selected && qtyReceived > 0 && (
              <div className="rounded-xl border border-orange-200 bg-white p-3 text-sm">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>New stock level</span>
                  <span className="font-bold text-gray-900">
                    {Math.round((selected.stock + qtyReceived) * 1000) / 1000}{" "}
                    {selected.unit}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>Batch value</span>
                  <span className="font-bold text-gray-900">
                    ₹{(qtyReceived * unitCost).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <PackageCheck className="h-4 w-4" />
              Receive Batch
            </button>
          </div>
        </div>

        {/* Received history */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Received Batches
            </h3>
            <div className="text-xs text-gray-500">
              Total received value ·{" "}
              <span className="font-bold text-gray-900">
                ₹{totalReceivedValue.toLocaleString("en-IN")}
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Unit Cost</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3">Received</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {batches.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-12 text-center text-sm text-gray-400"
                      >
                        No goods received yet. Log a batch to top up stock.
                      </td>
                    </tr>
                  ) : (
                    batches.map((b) => (
                      <tr key={b.id} className="transition hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1.5 font-semibold text-gray-900">
                            <Hash className="h-3.5 w-3.5 text-gray-400" />
                            {b.batchNumber}
                          </div>
                          <div className="text-[11px] text-gray-400">
                            {b.supplierName}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-700">
                          {b.itemName}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-700">
                          +{b.qtyReceived} {b.unit}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                          ₹{b.unitCost}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                          ₹{grnValue(b).toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                            {formatRelativeDate(
                              new Date(b.receivedAt).toISOString().slice(0, 10),
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Recipe Prep Deduction view ---------- */

function PrepView({
  items,
  logs,
  onLogPrep,
}: {
  items: InventoryItem[];
  logs: PrepBatchLog[];
  onLogPrep: (entry: {
    recipeId: string;
    yieldQty: number;
    preparedBy: string;
  }) => LogPrepResult;
}) {
  const [recipeId, setRecipeId] = useState<string>(PREP_RECIPES[0]?.id ?? "");
  const [yieldQty, setYieldQty] = useState<number>(0);
  const [preparedBy, setPreparedBy] = useState<string>(PREP_STAFF[0]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const recipe = PREP_RECIPES.find((r) => r.id === recipeId);

  const preview = useMemo(() => {
    if (!recipe || yieldQty <= 0)
      return { consumed: [] as PrepConsumption[], shortfalls: [] as PrepConsumption[] };
    return computePrepDraw(recipe, yieldQty, items);
  }, [recipe, yieldQty, items]);

  // Batch is blocked when stock is insufficient — guard here prevents flooring to zero
  const canSubmit =
    !!recipe && yieldQty > 0 && preview.shortfalls.length === 0;

  const submit = () => {
    if (!canSubmit || !recipe || submittingRef.current) return;
    submittingRef.current = true;
    const result = onLogPrep({ recipeId: recipe.id, yieldQty, preparedBy });
    submittingRef.current = false;
    if (result.ok) {
      setYieldQty(0);
      setSubmitError(null);
    } else {
      setSubmitError(result.error ?? "Unable to log batch.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
        {/* Prep entry form */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-gray-900">
                Daily Recipe Prep
              </div>
              <div className="text-xs text-gray-500">
                Log a production batch — raw ingredients deduct automatically.
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                Base Preparation
              </label>
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {PREP_RECIPES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Qty Prepared {recipe ? `(${recipe.yieldUnit})` : ""}
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={yieldQty || ""}
                  onChange={(e) =>
                    setYieldQty(Math.max(0, Number(e.target.value) || 0))
                  }
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold tabular-nums focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-gray-500">
                  Prepared By
                </label>
                <select
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-800 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {PREP_STAFF.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live drawdown preview */}
            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-gray-500">
                <ArrowDownRight className="h-3.5 w-3.5" />
                Ingredient Drawdown
              </div>
              {preview.consumed.length === 0 ? (
                <p className="py-2 text-center text-xs text-gray-400">
                  Enter a quantity to preview the raw ingredient deduction.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {preview.consumed.map((c) => {
                    const short = preview.shortfalls.find(
                      (s) => s.inventoryId === c.inventoryId,
                    );
                    return (
                      <li
                        key={c.inventoryId}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="text-gray-700">{c.name}</span>
                        <span
                          className={`font-semibold tabular-nums ${
                            short ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          −{c.qty} {c.unit}
                          {short && (
                            <span className="ml-1 text-[11px] font-bold text-red-500">
                              (short {short.qty})
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {preview.shortfalls.length > 0 && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Stock too low for {preview.shortfalls.length} ingredient
                  {preview.shortfalls.length > 1 ? "s" : ""} — batch is blocked.
                  Top up before submitting.
                </div>
              )}
              {submitError && (
                <div className="mt-2 flex items-start gap-1.5 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-700">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {submitError}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!canSubmit}
              onClick={submit}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <ChefHat className="h-4 w-4" />
              Log Prep & Deduct
            </button>
          </div>
        </div>

        {/* Prep history */}
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-gray-900">Production Log</h3>
          {logs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-16 text-center">
              <ChefHat className="mx-auto h-8 w-8 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-500">
                No prep logged yet.
              </p>
              <p className="text-xs text-gray-400">
                Log a production batch to auto-deduct raw ingredients.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                    <div>
                      <div className="font-extrabold text-gray-900">
                        {log.recipeName}
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <ChefHat className="h-3 w-3" />
                        {log.preparedBy}
                        <span className="text-gray-300">·</span>
                        <CalendarDays className="h-3 w-3" />
                        {formatRelativeDate(
                          new Date(log.at).toISOString().slice(0, 10),
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        Yield
                      </div>
                      <div className="text-lg font-extrabold text-emerald-600">
                        {log.yieldQty} {log.yieldUnit}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-4 py-3">
                    {log.consumed.map((c) => (
                      <span
                        key={c.inventoryId}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600"
                      >
                        <ArrowDownRight className="h-3 w-3 text-red-400" />
                        {c.name}{" "}
                        <span className="tabular-nums text-red-600">
                          −{c.qty} {c.unit}
                        </span>
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- KPI Card ---------- */

function KpiCard({
  icon,
  label,
  value,
  subtle,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtle?: string;
  tone: "slate" | "red" | "orange";
}) {
  const ring =
    tone === "red"
      ? "ring-red-200"
      : tone === "orange"
        ? "ring-orange-200"
        : "ring-gray-200";
  const iconBg =
    tone === "red"
      ? "bg-red-100 text-red-600"
      : tone === "orange"
        ? "bg-orange-100 text-orange-600"
        : "bg-gray-100 text-gray-600";
  const valueColor =
    tone === "red"
      ? "text-red-600"
      : tone === "orange"
        ? "text-[color:var(--primary-orange)]"
        : "text-gray-900";

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border bg-white p-4 shadow-sm ring-1 ${ring} border-transparent`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBg}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {label}
        </div>
        <div className={`mt-0.5 text-2xl font-extrabold ${valueColor}`}>
          {value}
        </div>
        {subtle && (
          <div className="mt-0.5 text-[11px] text-gray-400">{subtle}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- Update Stock Side Panel ---------- */

function UpdateStockPanel({
  item,
  onClose,
  onSave,
}: {
  item: InventoryItem;
  onClose: () => void;
  onSave: (
    id: string,
    patch: {
      addStock: number;
      newPrice: number;
      supplierName: string;
      supplierContact: string;
    },
  ) => void;
}) {
  const [addStock, setAddStock] = useState<number>(0);
  const [newPrice, setNewPrice] = useState<number>(item.unitPrice);
  const [supplierName, setSupplierName] = useState(item.supplierName);
  const [supplierContact, setSupplierContact] = useState(item.supplierContact);

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const projected = Math.max(0, item.stock + addStock);
  const totalCost = addStock > 0 ? addStock * newPrice : 0;
  const status = statusOf({ ...item, stock: projected });

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
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
              Update Stock
            </div>
            <h2 className="mt-0.5 truncate text-lg font-extrabold text-gray-900">
              {item.name}
            </h2>
            <div className="mt-1 inline-flex items-center gap-1.5 text-xs text-gray-500">
              <span>
                Current:{" "}
                <span className="font-semibold text-gray-700">
                  {item.stock} {item.unit}
                </span>
              </span>
              <span className="text-gray-300">·</span>
              <span>
                Min:{" "}
                <span className="font-semibold text-gray-700">
                  {item.minLevel} {item.unit}
                </span>
              </span>
            </div>
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {/* Add Stock */}
          <section>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Add Stock ({item.unit})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAddStock((v) => Math.max(0, v - 1))}
                className="h-10 w-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                value={addStock}
                onChange={(e) =>
                  setAddStock(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-10 flex-1 rounded-lg border border-gray-200 px-3 text-center text-base font-bold tabular-nums text-gray-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
              <button
                type="button"
                onClick={() => setAddStock((v) => v + 1)}
                className="h-10 w-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[5, 10, 25, 50, 100].map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAddStock((v) => v + q)}
                  className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                >
                  +{q}
                </button>
              ))}
            </div>
          </section>

          {/* Purchase price */}
          <section>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Purchase Price (₹ per {item.unit})
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                ₹
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={newPrice}
                onChange={(e) =>
                  setNewPrice(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-10 w-full rounded-lg border border-gray-200 pl-7 pr-3 text-sm font-semibold tabular-nums text-gray-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </section>

          {/* Supplier */}
          <section className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-500">
              <Truck className="h-3.5 w-3.5" /> Supplier Details
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                Supplier Name
              </label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="h-9 w-full rounded-md border border-gray-200 bg-white px-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                Contact Number
              </label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  value={supplierContact}
                  onChange={(e) => setSupplierContact(e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white pl-8 pr-3 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
          </section>

          {/* Summary */}
          <section className="rounded-xl border border-orange-200 bg-orange-50/50 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-600">
              <span>Projected Stock</span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${STATUS_BADGE[status]}`}
              >
                {status}
              </span>
            </div>
            <div className="mt-1 text-2xl font-extrabold text-gray-900">
              {projected}{" "}
              <span className="text-sm font-medium text-gray-500">
                {item.unit}
              </span>
            </div>
            {addStock > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-orange-200 pt-2 text-xs text-gray-600">
                <span>Total purchase cost</span>
                <span className="font-bold text-gray-900">
                  ₹{totalCost.toLocaleString("en-IN")}
                </span>
              </div>
            )}
          </section>
        </div>

        <footer className="flex items-center gap-2 border-t border-gray-200 bg-white px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(item.id, {
                addStock,
                newPrice,
                supplierName,
                supplierContact,
              })
            }
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            {addStock > 0 ? (
              <>
                <Plus className="h-4 w-4" />
                Save & Restock
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Save Changes
              </>
            )}
          </button>
        </footer>
      </motion.aside>
    </>
  );
}
