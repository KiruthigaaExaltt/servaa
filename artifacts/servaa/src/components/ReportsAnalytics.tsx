import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Calendar, Download, MapPin, Receipt, Users } from "lucide-react";

type Section = "sales" | "operations" | "tax" | "staff";
type Range = "today" | "7d" | "30d";

interface Report {
  sales: { revenue: number; subtotal: number; discount: number; orders: number; averageOrderValue: number; cgst: number; sgst: number };
  paymentSplit: Array<{ method: string; value: number; count: number }>;
  hourly: Array<{ hour: number; value: number; orders: number }>;
  ledger: Array<{ type: string; value: number }>;
  kds: Array<{ _id?: string; items: number; voided: number }>;
  inventory: Array<{ type: string; quantity: number; value: number }>;
  labour: Array<{ _id: string; staffName?: string; events: number }>;
  items: Array<{ name: string; units: number; revenue: number }>;
  tables: Array<{ tableId?: string; orders: number; revenue: number; firstAt?: string; lastAt?: string }>;
  staff: Array<{ name: string; orders: number; revenue: number }>;
  delivery: Array<{ source?: string; orders: number; delivered: number; revenue: number }>;
  adjustments: Array<{ status: string; count: number; value: number }>;
  dailyTax: Array<{ date: string; taxable: number; cgst: number; sgst: number }>;
}

const sections = [
  { id: "sales" as const, label: "Sales", icon: BarChart3 },
  { id: "operations" as const, label: "Operations", icon: Activity },
  { id: "tax" as const, label: "Tax & Compliance", icon: Receipt },
  { id: "staff" as const, label: "Staff Performance", icon: Users },
];
const ranges: Array<{ id: Range; label: string; days: number }> = [
  { id: "today", label: "Today", days: 1 }, { id: "7d", label: "7 days", days: 7 }, { id: "30d", label: "30 days", days: 30 },
];
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value);
const apiBase = (import.meta.env.VITE_API_BASE ?? "/api").replace(/\/$/, "");

function Cards({ values }: { values: Array<{ label: string; value: string | number }> }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{values.map((item) => <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-gray-500">{item.label}</p><p className="mt-2 text-2xl font-black text-gray-900">{item.value}</p></div>)}</div>;
}

function DataTable({ headers, rows, empty }: { headers: string[]; rows: Array<Array<string | number>>; empty: string }) {
  if (!rows.length) return <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">{empty}</div>;
  return <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500"><tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-4 py-3 font-medium text-gray-700">{cell}</td>)}</tr>)}</tbody></table></div></div>;
}

export function ReportsAnalytics() {
  const [section, setSection] = useState<Section>("sales");
  const [range, setRange] = useState<Range>("7d");
  const [zone, setZone] = useState("All");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const zones = ["All", "Indoor", "Garden", "Private Dining"];

  useEffect(() => {
    const controller = new AbortController();
    const days = ranges.find((item) => item.id === range)?.days ?? 7;
    const to = new Date();
    const from = new Date(to);
    if (range === "today") from.setHours(0, 0, 0, 0); else from.setDate(from.getDate() - days);
    setLoading(true); setError("");
    fetch(`${apiBase}/reports/summary?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}&zone=${encodeURIComponent(zone)}`, {
      credentials: "include", signal: controller.signal, headers: { "x-outlet-slug": import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main" },
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? "Unable to load report");
      return response.json() as Promise<Report>;
    }).then(setReport).catch((reason: Error) => { if (reason.name !== "AbortError") setError(reason.message); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [range, zone]);

  const csvRows = useMemo(() => {
    if (!report) return [];
    if (section === "sales") return [["Payment method", "Value", "Orders"], ...report.paymentSplit.map((x) => [x.method || "Unknown", x.value, x.count])];
    if (section === "operations") return [["Item", "Units", "Revenue"], ...report.items.map((x) => [x.name, x.units, x.revenue])];
    if (section === "tax") return [["Date", "Taxable", "CGST", "SGST"], ...report.dailyTax.map((x) => [x.date, x.taxable, x.cgst, x.sgst])];
    return [["Staff", "Orders", "Revenue"], ...report.staff.map((x) => [x.name, x.orders, x.revenue])];
  }, [report, section]);

  const exportCsv = () => {
    if (!csvRows.length) return;
    const content = csvRows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `servaa-${section}-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <Calendar className="h-4 w-4 text-gray-400" />
      {ranges.map((item) => <button key={item.id} onClick={() => setRange(item.id)} className={`rounded-lg px-3 py-2 text-xs font-bold uppercase ${range === item.id ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"}`}>{item.label}</button>)}
      <div className="ml-auto flex items-center gap-2"><MapPin className="h-4 w-4 text-gray-400" /><select value={zone} onChange={(event) => setZone(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold">{zones.map((item) => <option key={item}>{item}</option>)}</select><button disabled={!report} onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"><Download className="h-4 w-4" /> Export</button></div>
    </div>
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setSection(item.id)} className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-bold ${section === item.id ? "border-orange-400 bg-orange-50 text-orange-700" : "border-gray-200 bg-white text-gray-600"}`}><Icon className="h-4 w-4" />{item.label}</button>; })}</div>
    {loading && <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">Calculating report from transaction data…</div>}
    {!loading && error && <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">{error}</div>}
    {!loading && !error && report && section === "sales" && <div className="space-y-4"><Cards values={[{ label: "Revenue", value: money(report.sales.revenue) }, { label: "Orders", value: report.sales.orders }, { label: "Average order", value: money(report.sales.averageOrderValue) }, { label: "Discounts", value: money(report.sales.discount) }]} /><DataTable headers={["Payment method", "Value", "Orders"]} rows={report.paymentSplit.map((x) => [x.method || "Unknown", money(x.value), x.count])} empty="No settled payments in this period." /><DataTable headers={["Item", "Units", "Revenue"]} rows={report.items.map((x) => [x.name, x.units, money(x.revenue)])} empty="No sold items in this period." /></div>}
    {!loading && !error && report && section === "operations" && <div className="space-y-4"><Cards values={[{ label: "Delivery orders", value: report.delivery.reduce((n, x) => n + x.orders, 0) }, { label: "Delivered", value: report.delivery.reduce((n, x) => n + x.delivered, 0) }, { label: "Inventory movements", value: report.inventory.reduce((n, x) => n + Math.abs(x.quantity), 0) }, { label: "Adjustments", value: report.adjustments.reduce((n, x) => n + x.count, 0) }]} /><DataTable headers={["Table", "Orders", "Revenue"]} rows={report.tables.map((x) => [x.tableId || "Unassigned", x.orders, money(x.revenue)])} empty="No table transactions in this period." /><DataTable headers={["Kitchen station", "Items", "Voided"]} rows={report.kds.map((x) => [x._id || "Unassigned", x.items, x.voided])} empty="No kitchen activity in this period." /></div>}
    {!loading && !error && report && section === "tax" && <div className="space-y-4"><Cards values={[{ label: "Taxable sales", value: money(report.dailyTax.reduce((n, x) => n + x.taxable, 0)) }, { label: "CGST", value: money(report.sales.cgst) }, { label: "SGST", value: money(report.sales.sgst) }, { label: "Refunds / voids", value: money(report.adjustments.reduce((n, x) => n + x.value, 0)) }]} /><DataTable headers={["Date", "Taxable", "CGST", "SGST"]} rows={report.dailyTax.map((x) => [x.date, money(x.taxable), money(x.cgst), money(x.sgst)])} empty="No taxable transactions in this period." /></div>}
    {!loading && !error && report && section === "staff" && <div className="space-y-4"><Cards values={[{ label: "Active staff", value: report.staff.length }, { label: "Clock events", value: report.labour.reduce((n, x) => n + x.events, 0) }, { label: "Served orders", value: report.staff.reduce((n, x) => n + x.orders, 0) }, { label: "Attributed revenue", value: money(report.staff.reduce((n, x) => n + x.revenue, 0)) }]} /><DataTable headers={["Staff", "Orders", "Revenue"]} rows={report.staff.map((x) => [x.name, x.orders, money(x.revenue)])} empty="No staff-attributed transactions in this period." /><DataTable headers={["Staff", "Clock events"]} rows={report.labour.map((x) => [x.staffName || x._id, x.events])} empty="No clock activity in this period." /></div>}
  </div>;
}
