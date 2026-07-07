import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Search,
  QrCode,
  Users,
  LayoutGrid,
  Map as MapIcon,
  CheckSquare,
  Square,
  ChevronDown,
  Power,
  PowerOff,
  ArrowRightLeft,
  AlertTriangle,
  Sofa,
  Coffee,
  Wine,
  Trees,
} from "lucide-react";
import {
  SEED_TABLE_MASTERS,
  SEED_ZONES,
  ZONE_COLOR_OPTIONS,
  ZONE_TONE,
  type TableMaster,
  type TableType,
  type Zone,
} from "@/lib/tablesAdminData";
import { useCollectionState } from "@/lib/collectionState";

const TABLE_TYPES: TableType[] = [
  "Standard",
  "Booth",
  "Bar Counter",
  "High Top",
  "Patio",
];

const TYPE_ICON: Record<TableType, typeof Sofa> = {
  Standard: LayoutGrid,
  Booth: Sofa,
  "Bar Counter": Wine,
  "High Top": Coffee,
  Patio: Trees,
};

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

export function TablesManagement() {
  const [zones, setZones] = useCollectionState<Zone[]>("table_zones", SEED_ZONES);
  const [tables, setTables] = useCollectionState<TableMaster[]>("table_master", SEED_TABLE_MASTERS);
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState<string>("All");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TableMaster | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState<null | "zone" | "status">(null);
  const [renamingZoneId, setRenamingZoneId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      2800,
    );
  };

  const zoneById = (id: string) => zones.find((z) => z.id === id);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tables
      .filter((t) => {
        if (zoneFilter !== "All" && t.zone !== zoneFilter) return false;
        if (
          q &&
          !t.id.toLowerCase().includes(q) &&
          !(t.qrCode ?? "").toLowerCase().includes(q) &&
          !(zoneById(t.zone)?.name ?? "").toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables, query, zoneFilter, zones]);

  const allVisibleSelected =
    visible.length > 0 && visible.every((t) => selected.has(t.id));

  const stats = useMemo(() => {
    const total = tables.length;
    const active = tables.filter((t) => t.isActive).length;
    const seats = tables.reduce((s, t) => s + t.capacity, 0);
    return { total, active, inactive: total - active, seats };
  }, [tables]);

  /* ---------- Zone CRUD ---------- */
  const addZone = () => {
    const used = new Set(zones.map((z) => z.color));
    const color =
      ZONE_COLOR_OPTIONS.find((c) => !used.has(c)) ?? "amber";
    const id = `z-${Date.now().toString(36)}`;
    const name = `New Zone ${zones.length + 1}`;
    setZones((arr) => [...arr, { id, name, color }]);
    setRenamingZoneId(id);
    pushToast(`Zone "${name}" created`);
  };

  const renameZone = (id: string, name: string) => {
    setZones((arr) => arr.map((z) => (z.id === id ? { ...z, name } : z)));
  };

  const deleteZone = (id: string) => {
    const z = zoneById(id);
    if (!z) return;
    const inUse = tables.some((t) => t.zone === id);
    if (inUse) {
      pushToast(`Move tables out of "${z.name}" first`, "warn");
      return;
    }
    setZones((arr) => arr.filter((zz) => zz.id !== id));
    if (zoneFilter === id) setZoneFilter("All");
    pushToast(`Zone "${z.name}" deleted`);
  };

  /* ---------- Table CRUD ---------- */
  const saveTable = (t: TableMaster, isNew: boolean) => {
    if (isNew) {
      setTables((arr) => [...arr, t]);
      pushToast(`Table ${t.id} added`);
    } else {
      setTables((arr) => arr.map((x) => (x.id === t.id ? t : x)));
      pushToast(`Table ${t.id} updated`);
    }
    setEditing(null);
    setCreating(false);
  };

  const deleteTable = (id: string) => {
    setTables((arr) => arr.filter((t) => t.id !== id));
    setSelected((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    pushToast(`Table ${id} removed`);
    setEditing(null);
  };

  /* ---------- Selection ---------- */
  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((t) => t.id)));
    }
  };

  /* ---------- Bulk Actions ---------- */
  const bulkMoveZone = (zoneId: string) => {
    const ids = Array.from(selected);
    setTables((arr) =>
      arr.map((t) => (selected.has(t.id) ? { ...t, zone: zoneId } : t)),
    );
    pushToast(
      `Moved ${ids.length} table${ids.length === 1 ? "" : "s"} to ${zoneById(zoneId)?.name}`,
    );
    setBulkOpen(null);
  };

  const bulkSetActive = (active: boolean) => {
    const ids = Array.from(selected);
    setTables((arr) =>
      arr.map((t) =>
        selected.has(t.id) ? { ...t, isActive: active } : t,
      ),
    );
    pushToast(
      `${ids.length} table${ids.length === 1 ? "" : "s"} marked ${active ? "Active" : "Under Maintenance"}`,
    );
    setBulkOpen(null);
  };

  return (
    <div className="space-y-4">
      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Tables" value={stats.total.toString()} />
        <Stat
          label="Active"
          value={stats.active.toString()}
          accent="emerald"
        />
        <Stat
          label="Under Maintenance"
          value={stats.inactive.toString()}
          accent={stats.inactive > 0 ? "red" : "slate"}
        />
        <Stat
          label="Total Seats"
          value={stats.seats.toString()}
          accent="orange"
        />
      </div>

      {/* Zone manager */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Zones
            </div>
            <p className="text-xs text-gray-400">
              Group tables by physical area for floor management & reports.
            </p>
          </div>
          <button
            type="button"
            onClick={addZone}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
            style={{ backgroundColor: "var(--primary-orange)" }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Zone
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {zones.map((z) => {
            const tone = ZONE_TONE[z.color] ?? ZONE_TONE.blue;
            const count = tables.filter((t) => t.zone === z.id).length;
            const isRenaming = renamingZoneId === z.id;
            return (
              <div
                key={z.id}
                className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 ring-1 ${tone.bg} ${tone.ring}`}
              >
                <span className={`h-2 w-2 rounded-full bg-${z.color}-500`} />
                {isRenaming ? (
                  <input
                    autoFocus
                    defaultValue={z.name}
                    onBlur={(e) => {
                      renameZone(z.id, e.target.value.trim() || z.name);
                      setRenamingZoneId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenamingZoneId(null);
                    }}
                    className={`w-32 rounded border-0 bg-white/60 px-1 py-0 text-sm font-semibold ${tone.text} focus:outline-none focus:ring-2 focus:ring-orange-200`}
                  />
                ) : (
                  <span className={`text-sm font-semibold ${tone.text}`}>
                    {z.name}
                  </span>
                )}
                <span className="text-[11px] font-bold text-gray-400">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => setRenamingZoneId(z.id)}
                  className="ml-1 rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-gray-700"
                  aria-label={`Rename ${z.name}`}
                  title="Rename"
                >
                  <Pencil className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteZone(z.id)}
                  className="rounded p-0.5 text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-red-600"
                  aria-label={`Delete ${z.name}`}
                  title="Delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Two column: list + blueprint */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Table master list */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by table, zone or QRâ€¦"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-gray-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
            >
              <option value="All">All Zones</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Table
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-3 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      className="rounded p-0.5 text-gray-500 hover:bg-gray-200"
                      aria-label="Select all visible"
                    >
                      {allVisibleSelected ? (
                        <CheckSquare className="h-4 w-4 text-orange-600" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3">Table ID</th>
                  <th className="px-3 py-3">Zone</th>
                  <th className="px-3 py-3 text-right">Pax</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">QR Code</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-3 py-12 text-center text-sm text-gray-400"
                    >
                      No tables match those filters.
                    </td>
                  </tr>
                ) : (
                  visible.map((t) => {
                    const z = zoneById(t.zone);
                    const tone = z ? ZONE_TONE[z.color] : ZONE_TONE.blue;
                    const Icon = TYPE_ICON[t.type];
                    const isSel = selected.has(t.id);
                    const isHi = highlightId === t.id;
                    return (
                      <tr
                        key={t.id}
                        onMouseEnter={() => setHighlightId(t.id)}
                        onClick={() => setHighlightId(t.id)}
                        className={`cursor-pointer transition ${
                          isHi
                            ? "bg-orange-50/60"
                            : isSel
                              ? "bg-orange-50/30"
                              : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelect(t.id);
                            }}
                            className="rounded p-0.5"
                            aria-label={`Select ${t.id}`}
                          >
                            {isSel ? (
                              <CheckSquare className="h-4 w-4 text-orange-600" />
                            ) : (
                              <Square className="h-4 w-4 text-gray-400" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[13px] font-bold text-gray-900">
                          {t.id}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ${tone.bg} ${tone.ring} ${tone.text}`}
                          >
                            {z?.name ?? "â€”"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <span className="inline-flex items-center gap-1 font-semibold text-gray-700">
                            <Users className="h-3 w-3 text-gray-400" />
                            {t.capacity}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700">
                            <Icon className="h-3.5 w-3.5 text-gray-400" />
                            {t.type}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          {t.qrCode ? (
                            <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] text-gray-700">
                              <QrCode className="h-3 w-3" />
                              {t.qrCode}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-300">
                              Unlinked
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {t.isActive ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-red-700 ring-1 ring-red-200">
                              Maintenance
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditing(t);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
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

        {/* Blueprint panel */}
        <BlueprintPanel
          tables={tables}
          zones={zones}
          highlightId={highlightId}
          onSelect={(id) => setHighlightId(id)}
        />
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-2xl"
          >
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-700">
              {selected.size} selected
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setBulkOpen(bulkOpen === "zone" ? null : "zone")}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Move to Zone
                <ChevronDown className="h-3 w-3" />
              </button>
              {bulkOpen === "zone" && (
                <div className="absolute bottom-full left-0 mb-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  {zones.map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => bulkMoveZone(z.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-gray-700 hover:bg-orange-50"
                    >
                      <span className={`h-2 w-2 rounded-full bg-${z.color}-500`} />
                      {z.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setBulkOpen(bulkOpen === "status" ? null : "status")
                }
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-gray-700 hover:border-orange-300 hover:bg-orange-50"
              >
                <Power className="h-3.5 w-3.5" />
                Change Status
                <ChevronDown className="h-3 w-3" />
              </button>
              {bulkOpen === "status" && (
                <div className="absolute bottom-full left-0 mb-2 w-52 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={() => bulkSetActive(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                  >
                    <Power className="h-3.5 w-3.5" />
                    Mark Active
                  </button>
                  <button
                    type="button"
                    onClick={() => bulkSetActive(false)}
                    className="flex w-full items-center gap-2 border-t border-gray-100 px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50"
                  >
                    <PowerOff className="h-3.5 w-3.5" />
                    Mark Under Maintenance
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-1 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add / Edit modal */}
      <AnimatePresence>
        {(editing || creating) && (
          <TableModal
            key={editing?.id ?? "new"}
            existing={editing}
            zones={zones}
            allTableIds={tables.map((t) => t.id)}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSave={saveTable}
            onDelete={editing ? () => deleteTable(editing.id) : undefined}
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

/* ---------- Stat ---------- */

function Stat({
  label,
  value,
  accent = "slate",
}: {
  label: string;
  value: string;
  accent?: "slate" | "emerald" | "red" | "orange";
}) {
  const tone =
    accent === "emerald"
      ? "text-emerald-600"
      : accent === "red"
        ? "text-red-600"
        : accent === "orange"
          ? "text-[color:var(--primary-orange)]"
          : "text-gray-900";
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className={`mt-0.5 text-2xl font-extrabold ${tone}`}>{value}</div>
    </div>
  );
}

/* ---------- Blueprint ---------- */

function BlueprintPanel({
  tables,
  zones,
  highlightId,
  onSelect,
}: {
  tables: TableMaster[];
  zones: Zone[];
  highlightId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <MapIcon className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900">Floor Blueprint</h3>
        </div>
        <span className="text-[11px] text-gray-400">
          Click a table in the list to highlight
        </span>
      </div>
      <div className="relative aspect-[4/5] w-full bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.05)_1px,transparent_0)] bg-[length:14px_14px] p-3">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {/* Zone backgrounds â€” quadrants matching coordsFor */}
          {zones.map((z, i) => {
            const tone = ZONE_TONE[z.color] ?? ZONE_TONE.blue;
            const ox = i % 2 === 0 ? 4 : 52;
            const oy = i < 2 ? 4 : 50;
            return (
              <g key={z.id}>
                <rect
                  x={ox}
                  y={oy}
                  width={44}
                  height={44}
                  rx={2}
                  className={tone.fill}
                  strokeWidth={0.3}
                />
                <text
                  x={ox + 2}
                  y={oy + 4}
                  className={`fill-current text-[2.5px] font-bold uppercase ${tone.text}`}
                  style={{ fontSize: 2.5 }}
                >
                  {z.name}
                </text>
              </g>
            );
          })}
          {/* Tables */}
          {tables.map((t) => {
            const z = zones.find((zz) => zz.id === t.zone);
            const tone = z ? ZONE_TONE[z.color] : ZONE_TONE.blue;
            const isHi = highlightId === t.id;
            const size =
              t.capacity >= 8 ? 6 : t.capacity >= 4 ? 5 : 4;
            return (
              <g
                key={t.id}
                onClick={() => onSelect(t.id)}
                style={{ cursor: "pointer" }}
              >
                {isHi && (
                  <circle
                    cx={t.x + size / 2}
                    cy={t.y + size / 2}
                    r={size + 2}
                    className="fill-orange-300/40 stroke-orange-500"
                    strokeWidth={0.6}
                  />
                )}
                <rect
                  x={t.x}
                  y={t.y}
                  width={size}
                  height={size}
                  rx={1}
                  className={`${
                    !t.isActive
                      ? "fill-red-200 stroke-red-400"
                      : isHi
                        ? "fill-orange-400 stroke-orange-600"
                        : `${tone.fill}`
                  }`}
                  strokeWidth={0.4}
                />
                <text
                  x={t.x + size / 2}
                  y={t.y + size / 2 + 1}
                  textAnchor="middle"
                  className={`fill-current font-bold ${
                    isHi ? "text-white" : tone.text
                  }`}
                  style={{ fontSize: 2 }}
                >
                  {t.id}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2 text-[11px] text-gray-500">
        {zones.map((z) => (
          <span key={z.id} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm bg-${z.color}-400`} />
            {z.name}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-red-400" />
          Maintenance
        </span>
      </div>
    </div>
  );
}

/* ---------- Add / Edit Modal ---------- */

function TableModal({
  existing,
  zones,
  allTableIds,
  onClose,
  onSave,
  onDelete,
}: {
  existing: TableMaster | null;
  zones: Zone[];
  allTableIds: string[];
  onClose: () => void;
  onSave: (t: TableMaster, isNew: boolean) => void;
  onDelete?: () => void;
}) {
  const isNew = !existing;
  const [id, setId] = useState(existing?.id ?? "");
  const [zoneId, setZoneId] = useState(existing?.zone ?? zones[0]?.id ?? "");
  const [capacity, setCapacity] = useState(existing?.capacity ?? 4);
  const [type, setType] = useState<TableType>(existing?.type ?? "Standard");
  const [isActive, setIsActive] = useState(existing?.isActive ?? true);
  const [qrCode, setQrCode] = useState(existing?.qrCode ?? "");

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  const trimmedId = id.trim().toUpperCase();
  const idCollision =
    isNew && allTableIds.some((x) => x.toUpperCase() === trimmedId);
  const canSave = trimmedId.length > 0 && capacity > 0 && zoneId && !idCollision;

  const submit = () => {
    if (!canSave) return;
    const next: TableMaster = {
      id: isNew ? trimmedId : (existing as TableMaster).id,
      zone: zoneId,
      capacity,
      type,
      isActive,
      qrCode: qrCode.trim() || undefined,
      x: existing?.x ?? 8 + Math.random() * 80,
      y: existing?.y ?? 8 + Math.random() * 80,
    };
    onSave(next, isNew);
  };

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
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                {isNew ? "Add New Table" : "Edit Table"}
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {isNew ? "Configure a new table" : `Table ${existing?.id}`}
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
          <div className="space-y-4 px-5 py-5">
            <Field label="Table Number">
              <input
                value={id}
                disabled={!isNew}
                onChange={(e) => setId(e.target.value)}
                placeholder="e.g. T-13 or R-5"
                className="h-10 w-full rounded-lg border border-gray-200 px-3 font-mono text-sm font-bold uppercase text-gray-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100 disabled:bg-gray-50 disabled:text-gray-500"
              />
              {idCollision && (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  A table with this ID already exists.
                </div>
              )}
            </Field>
            <Field label="Section">
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity (Pax)">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCapacity((v) => Math.max(1, v - 1))}
                    className="h-10 w-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                  >
                    âˆ’
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={capacity}
                    onChange={(e) =>
                      setCapacity(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="h-10 flex-1 rounded-lg border border-gray-200 px-2 text-center text-base font-bold tabular-nums text-gray-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                  />
                  <button
                    type="button"
                    onClick={() => setCapacity((v) => v + 1)}
                    className="h-10 w-10 rounded-lg border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </Field>
              <Field label="Type">
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as TableType)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {TABLE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="QR Association">
              <div className="relative">
                <QrCode className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={qrCode}
                  onChange={(e) => setQrCode(e.target.value.toUpperCase())}
                  placeholder="QR042"
                  className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 font-mono text-sm uppercase text-gray-900 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">
                Link this table to a QR code so guests can self-order on scan.
              </p>
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div>
                <div className="text-sm font-semibold text-gray-900">
                  Active for service
                </div>
                <div className="text-[11px] text-gray-500">
                  Inactive tables won't appear on the live floor.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsActive((v) => !v)}
                aria-pressed={isActive}
                className={`relative h-6 w-11 rounded-full transition ${
                  isActive ? "bg-emerald-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    isActive ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            {!isNew && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canSave}
                onClick={submit}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ backgroundColor: "var(--primary-orange)" }}
              >
                <Check className="h-4 w-4" />
                {isNew ? "Add Table" : "Save Changes"}
              </button>
            </div>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}
