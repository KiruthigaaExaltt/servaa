import { useMemo, useState } from "react";
import { Shield, Search, ChevronDown, ChevronUp } from "lucide-react";
import { useAudit, type AuditEntry } from "@/context/AuditContext";
import { useRole } from "@/context/RoleContext";

const MODULE_LABELS: Record<string, string> = {
  foh: "FOH",
  orders: "Orders",
  inventory: "Inventory",
  accounts: "Accounts",
  settings: "Settings",
  system: "System",
  crew: "Crew",
  "kot-kds": "KDS",
};

function formatTs(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function AuditLog() {
  const { entries } = useAudit();
  const { can } = useRole();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.action.toLowerCase().includes(q) ||
        e.detail.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.module.toLowerCase().includes(q),
    );
  }, [entries, search]);

  if (!can("view_reports")) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-500" />
          <span className="font-semibold text-gray-900">Audit Log</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
            {entries.length}
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5">
          <div className="mt-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter events…"
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="mt-4 text-center text-sm text-gray-400">
              {entries.length === 0 ? "No audit events recorded yet." : "No events match your filter."}
            </p>
          ) : (
            <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-bold uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="py-2 pl-3 text-left">Time</th>
                    <th className="py-2 text-left">Role</th>
                    <th className="py-2 text-left">Module</th>
                    <th className="py-2 text-left">Action</th>
                    <th className="py-2 pr-3 text-left">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((e: AuditEntry) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap py-2 pl-3 font-mono text-gray-500">
                        {formatTs(e.at)}
                      </td>
                      <td className="py-2">
                        <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-gray-700">
                          {e.role}
                        </span>
                      </td>
                      <td className="py-2 text-gray-500">
                        {MODULE_LABELS[e.module] ?? e.module}
                      </td>
                      <td className="py-2 font-medium text-gray-800">
                        {e.action.replaceAll("_", " ")}
                      </td>
                      <td className="max-w-[200px] truncate py-2 pr-3 text-gray-500">
                        {e.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
