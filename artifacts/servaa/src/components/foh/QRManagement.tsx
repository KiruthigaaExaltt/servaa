import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Printer,
  Download,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Power,
  PowerOff,
  Sparkles,
  Wand2,
} from "lucide-react";
import QRCode from "qrcode";
import { useFOH } from "@/context/FOHContext";
import { useToast } from "@/hooks/use-toast";
import { QRCanvas } from "@/components/foh/QRCanvas";
import type { QRCard } from "@/lib/fohData";

const INITIAL_VERSION = "v2.4.1";

const BASE_ORDER_URL = `${
  typeof window !== "undefined" ? window.location.origin : "https://servaa.app"
}/order/servaa`;

function tableOrderUrl(tableId: string): string {
  return `${BASE_ORDER_URL}?t=${encodeURIComponent(tableId)}`;
}

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function bumpPatch(version: string): string {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return version;
  const [, major, minor, patch] = match;
  return `v${major}.${minor}.${Number(patch) + 1}`;
}

async function downloadQRPng(tableId: string, url: string): Promise<void> {
  const dataUrl = await QRCode.toDataURL(url, { width: 256, margin: 2 });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `QR-${tableId}.png`;
  a.click();
}

async function openQRPrintWindow(
  cards: { tableId: string; url: string; menuVersion: string }[],
): Promise<void> {
  const items = await Promise.all(
    cards.map(async ({ tableId, url, menuVersion }) => {
      const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
      return { tableId, dataUrl, menuVersion };
    }),
  );

  const cardHtml = items
    .map(
      ({ tableId, dataUrl, menuVersion }) => `
      <div class="card">
        <img src="${dataUrl}" alt="QR for ${tableId}" />
        <div class="label">${tableId}</div>
        <div class="scan">Scan to Order</div>
        <div class="ver">${menuVersion}</div>
      </div>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>QR Codes – Servaa</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: sans-serif; }
    body { padding: 16px; }
    h1 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #FF7A1A; }
    .grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .card { text-align: center; border: 1px solid #ddd; border-radius: 8px; padding: 12px; page-break-inside: avoid; }
    .card img { width: 160px; height: 160px; display: block; margin: 0 auto; }
    .label { font-weight: 700; font-size: 14px; margin-top: 6px; }
    .scan { font-size: 11px; color: #FF7A1A; font-weight: 600; margin-top: 2px; }
    .ver { font-size: 10px; color: #888; font-family: monospace; margin-top: 2px; }
    @media print { body { padding: 4px; } }
  </style>
</head>
<body>
  <h1>Servaa – QR Codes</h1>
  <div class="grid">${cardHtml}</div>
  <script>window.addEventListener("load", () => { window.print(); });</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=600");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

interface QRStatus {
  active: boolean;
  orderCount: number;
  healthy: boolean;
}

export function QRManagement() {
  const { qrs, regenerateQR, updateAllQRMenuVersion } = useFOH();
  const { toast } = useToast();

  const [menuVersion, setMenuVersion] = useState(INITIAL_VERSION);

  const [statusMap, setStatusMap] = useState<Record<string, QRStatus>>(() => {
    const map: Record<string, QRStatus> = {};
    qrs.forEach((q, i) => {
      map[q.tableId] = {
        active: i % 3 !== 2,
        orderCount: (i * 7) % 9,
        healthy: i % 5 !== 4,
      };
    });
    return map;
  });

  const status = (id: string): QRStatus =>
    statusMap[id] ?? { active: true, orderCount: 0, healthy: true };

  const setActive = (id: string, active: boolean) =>
    setStatusMap((prev) => ({
      ...prev,
      [id]: { ...status(id), active },
    }));

  const setAllActive = (active: boolean) =>
    setStatusMap((prev) => {
      const next = { ...prev };
      qrs.forEach((q) => {
        next[q.tableId] = { ...status(q.tableId), active };
      });
      return next;
    });

  const stats = useMemo(() => {
    let active = 0;
    let totalOrders = 0;
    qrs.forEach((q) => {
      const s = status(q.tableId);
      if (s.active) active++;
      totalOrders += s.orderCount;
    });
    const avg = qrs.length === 0 ? 0 : totalOrders / qrs.length;
    return { active, totalOrders, avg };
  }, [qrs, statusMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownloadAll = async () => {
    if (qrs.length === 0) return;
    toast({
      title: "Downloading…",
      description: `Generating ${qrs.length} PNG files.`,
    });
    for (const q of qrs) {
      await downloadQRPng(q.tableId, tableOrderUrl(q.tableId));
    }
    toast({
      title: "Download complete",
      description: `${qrs.length} QR images saved.`,
    });
  };

  const handleGenerateAll = () => {
    qrs.forEach((q) => regenerateQR(q.tableId));
    toast({
      title: "All QR codes regenerated",
      description: `${qrs.length} codes refreshed for ${menuVersion}.`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <QrCode className="h-5 w-5 text-gray-700" />
            QR Code Management
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Generate and manage QR codes for contactless ordering.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadAll}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
          >
            <Download className="h-4 w-4" />
            Download All
          </button>
          <button
            type="button"
            onClick={handleGenerateAll}
            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Sparkles className="h-4 w-4" />
            Generate All QR Codes
          </button>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          label="Active QRs"
          value={stats.active.toString()}
          color="text-emerald-600"
        />
        <KpiCard
          label="Total Orders"
          value={stats.totalOrders.toString()}
          color="text-orange-600"
        />
        <KpiCard
          label="Avg Orders / QR"
          value={stats.avg.toFixed(1)}
          color="text-blue-600"
        />
        <KpiCard
          label="Menu Version"
          value={menuVersion}
          color="text-gray-700"
          mono
        />
      </div>

      {/* QR Card Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {qrs.map((q) => (
          <QRCardTile
            key={q.tableId}
            qr={q}
            status={status(q.tableId)}
            onRegenerate={() => {
              regenerateQR(q.tableId);
              toast({
                title: "QR regenerated",
                description: `New code issued for ${q.tableId}.`,
              });
            }}
            onDownload={async () => {
              await downloadQRPng(q.tableId, tableOrderUrl(q.tableId));
              toast({
                title: "Downloaded",
                description: `QR-${q.tableId}.png saved.`,
              });
            }}
            onPrint={async () => {
              await openQRPrintWindow([
                {
                  tableId: q.tableId,
                  url: tableOrderUrl(q.tableId),
                  menuVersion: q.menuVersion,
                },
              ]);
            }}
            onToggleActive={() => {
              const cur = status(q.tableId).active;
              setActive(q.tableId, !cur);
              toast({
                title: !cur ? "QR activated" : "QR deactivated",
                description: `${q.tableId} is now ${!cur ? "live" : "offline"}.`,
              });
            }}
          />
        ))}
      </div>

      {/* Bulk Actions Footer */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">
            Bulk Actions
          </h3>
          <span className="text-xs text-gray-400">
            Applies to all {qrs.length} QR codes
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <BulkPill
            icon={<Power className="h-3.5 w-3.5" />}
            tone="emerald"
            onClick={() => {
              setAllActive(true);
              toast({
                title: "All QR codes activated",
                description: `${qrs.length} codes are now live.`,
              });
            }}
          >
            Activate All
          </BulkPill>
          <BulkPill
            icon={<PowerOff className="h-3.5 w-3.5" />}
            tone="gray"
            onClick={() => {
              setAllActive(false);
              toast({
                title: "All QR codes deactivated",
                description: `${qrs.length} codes are now offline.`,
              });
            }}
          >
            Deactivate All
          </BulkPill>
          <BulkPill
            icon={<Printer className="h-3.5 w-3.5" />}
            tone="blue"
            onClick={async () => {
              await openQRPrintWindow(
                qrs.map((q) => ({
                  tableId: q.tableId,
                  url: tableOrderUrl(q.tableId),
                  menuVersion: q.menuVersion,
                })),
              );
            }}
          >
            Print All
          </BulkPill>
          <BulkPill
            icon={<Wand2 className="h-3.5 w-3.5" />}
            tone="orange"
            onClick={() => {
              const next = bumpPatch(menuVersion);
              setMenuVersion(next);
              updateAllQRMenuVersion(next);
              qrs.forEach((q) => regenerateQR(q.tableId));
              toast({
                title: `Menu version bumped to ${next}`,
                description: `All ${qrs.length} QR codes updated and regenerated.`,
              });
            }}
          >
            Update Menu Version
          </BulkPill>
        </div>
      </section>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function KpiCard({
  label,
  value,
  color,
  mono,
}: {
  label: string;
  value: string;
  color: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-extrabold tabular-nums ${color} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function QRCardTile({
  qr,
  status,
  onRegenerate,
  onDownload,
  onPrint,
  onToggleActive,
}: {
  qr: QRCard;
  status: QRStatus;
  onRegenerate: () => void;
  onDownload: () => void;
  onPrint: () => void;
  onToggleActive: () => void;
}) {
  const codeId = `QR${qr.tableId.replace(/[^0-9]/g, "").padStart(3, "0")}`;

  return (
    <motion.div
      layout
      whileHover={{ y: -2 }}
      className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm transition ${
        status.active ? "border-gray-200" : "border-gray-200 opacity-90"
      }`}
    >
      {/* QR image — "Scan to Order" frame */}
      <div className="mx-auto">
        <div
          className="relative rounded-xl bg-white p-3 ring-1 ring-gray-200"
          style={{
            filter: status.active ? "none" : "grayscale(100%) opacity(0.55)",
          }}
        >
          {/* Orange L-corner brackets */}
          <span className="pointer-events-none absolute left-1.5 top-1.5 h-4 w-4 rounded-tl-md border-l-2 border-t-2" style={{ borderColor: "var(--primary-orange)" }} />
          <span className="pointer-events-none absolute right-1.5 top-1.5 h-4 w-4 rounded-tr-md border-r-2 border-t-2" style={{ borderColor: "var(--primary-orange)" }} />
          <span className="pointer-events-none absolute bottom-1.5 left-1.5 h-4 w-4 rounded-bl-md border-b-2 border-l-2" style={{ borderColor: "var(--primary-orange)" }} />
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 h-4 w-4 rounded-br-md border-b-2 border-r-2" style={{ borderColor: "var(--primary-orange)" }} />
          <QRCanvas value={tableOrderUrl(qr.tableId)} size={120} className="block" />
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--primary-orange)" }}>
          <QrCode className="h-3.5 w-3.5" />
          Scan to Order
        </div>
      </div>

      {/* Header row */}
      <div className="mt-3 flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Table
          </div>
          <div className="text-xl font-extrabold leading-tight text-gray-900">
            {qr.tableId}
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            status.active
              ? "text-white"
              : "bg-gray-200 text-gray-600"
          }`}
          style={
            status.active
              ? { backgroundColor: "var(--primary-orange)" }
              : undefined
          }
        >
          {status.active ? "Active" : "Inactive"}
        </span>
      </div>

      {/* Code + version */}
      <div className="mt-2 flex items-center justify-between text-[11px]">
        <span className="font-mono font-semibold text-gray-700">{codeId}</span>
        <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
          {qr.menuVersion}
        </span>
      </div>

      {/* Metrics */}
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
        <span>
          <span className="font-bold text-gray-700">{status.orderCount}</span>{" "}
          orders
        </span>
        <span>Last used: {formatRelative(qr.lastUsed)}</span>
      </div>

      {/* Regenerate */}
      <button
        type="button"
        onClick={onRegenerate}
        className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide shadow-sm transition ${
          status.active
            ? "text-white hover:brightness-110"
            : "border border-orange-300 bg-white text-orange-600 hover:bg-orange-50"
        }`}
        style={
          status.active
            ? { backgroundColor: "var(--primary-orange)" }
            : undefined
        }
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Regenerate
      </button>

      {/* Footer: Download + Print + Status */}
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={onDownload}
          title="Download QR as PNG"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </button>
        <button
          type="button"
          onClick={onPrint}
          title="Print QR card"
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </button>
        <button
          type="button"
          onClick={onToggleActive}
          title={status.healthy ? "Status check OK" : "Status check failed"}
          className={`inline-flex items-center justify-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${
            status.healthy
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          }`}
        >
          {status.healthy ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5" />
          )}
          {status.healthy ? "OK" : "Err"}
        </button>
      </div>
    </motion.div>
  );
}

function BulkPill({
  children,
  icon,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "emerald" | "gray" | "blue" | "orange";
  onClick: () => void;
}) {
  const styles: Record<typeof tone, string> = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    gray: "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100",
    blue: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${styles[tone]}`}
    >
      {icon}
      {children}
    </button>
  );
}
