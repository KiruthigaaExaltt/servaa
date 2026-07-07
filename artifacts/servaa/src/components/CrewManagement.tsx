import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users,
  Clock,
  AlertTriangle,
  Wallet,
  Search,
  Star,
  Phone,
  Mail,
  X,
  Check,
  Plus,
  Calendar,
  ClipboardList,
  Shield,
  LogIn,
  LogOut,
  FileText,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  CalendarDays,
} from "lucide-react";
import {
  ALL_PERMISSIONS,
  DAYS,
  ROLE_TONE,
  SEED_CREW,
  SEED_PERMISSIONS,
  SHIFT_SLOTS,
  STATUS_TONE,
  ZONES,
  formatINR,
  payoutForMonth,
  sessionDuration,
  type CrewRole,
  type CrewStatus,
  type Employee,
  type Permission,
  type ShiftAssignment,
  type ShiftSlot,
  type Zone,
} from "@/lib/crewData";
import { useCollectionState } from "@/lib/collectionState";

type TabId = "directory" | "roster" | "attendance" | "payroll" | "permissions";

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: "directory", label: "Directory", icon: Users },
  { id: "roster", label: "Weekly Roster", icon: CalendarDays },
  { id: "attendance", label: "Live Attendance", icon: Clock },
  { id: "payroll", label: "Payroll", icon: Wallet },
  { id: "permissions", label: "Permissions", icon: Shield },];

interface Toast {
  id: number;
  text: string;
  tone: "success" | "info" | "warn";
}

const ROLES: CrewRole[] = [
  "Admin",
  "Manager",
  "Head Chef",
  "Sous Chef",
  "Waiter",
  "Bartender",
  "Cashier",
  "Rider",
  "Cleaner",
];

const TOTAL_SALES_DEMO = 482000; // demo monthly figure for labor cost %

export function CrewManagement() {
  const [tab, setTab] = useState<TabId>("directory");
  const [crew, setCrew] = useCollectionState<Employee[]>("crew_employees", SEED_CREW);
  const [perms, setPerms] = useCollectionState<Record<CrewRole, Permission[]>>("crew_permissions", SEED_PERMISSIONS);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, setTick] = useState(0);

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
    const totalActive = crew.filter((e) => e.status !== "On Leave").length;
    const onDuty = crew.filter((e) => e.status === "On Duty").length;
    const monthlyLabor = crew.reduce((s, e) => s + e.baseSalary, 0);
    const laborPct = Math.round((monthlyLabor / TOTAL_SALES_DEMO) * 1000) / 10;
    // Shift gaps: any zone with no on-duty assignment for current/next slot
    const today = (new Date().getDay() + 6) % 7; // Mon=0
    const hour = new Date().getHours();
    const slot: ShiftSlot =
      hour < 8 || hour >= 24 ? "Night" : hour < 16 ? "Morning" : "Evening";
    const coveredZones = new Set<Zone>();
    crew
      .filter((e) => e.status === "On Duty")
      .forEach((e) =>
        e.shifts
          .filter((s) => s.day === today && s.slot === slot)
          .forEach((s) => coveredZones.add(s.zone)),
      );
    const gaps = ZONES.filter(
      (z) => z !== "Delivery" && z !== "Kitchen" && !coveredZones.has(z),
    );
    return {
      totalActive,
      onDuty,
      laborPct,
      gaps,
      slot,
    };
  }, [crew]);

  /* ---------- Crew mutations ---------- */
  const togglePunch = (id: string) => {
    setCrew((arr) =>
      arr.map((e) => {
        if (e.id !== id) return e;
        const last = e.punches[e.punches.length - 1];
        if (last && !last.outAt) {
          // Punch out
          const updated = [
            ...e.punches.slice(0, -1),
            { ...last, outAt: Date.now() },
          ];
          return { ...e, punches: updated, status: "Off Duty" };
        }
        return {
          ...e,
          punches: [...e.punches, { inAt: Date.now() }],
          status: "On Duty",
        };
      }),
    );
    const e = crew.find((x) => x.id === id);
    if (e) {
      const last = e.punches[e.punches.length - 1];
      const wasIn = last && !last.outAt;
      pushToast(
        `${e.name} ${wasIn ? "punched OUT" : "punched IN"}`,
        wasIn ? "info" : "success",
      );
    }
  };

  const setStatus = (id: string, status: CrewStatus) => {
    setCrew((arr) => arr.map((e) => (e.id === id ? { ...e, status } : e)));
    const e = crew.find((x) => x.id === id);
    if (e) pushToast(`${e.name} â†’ ${status}`, "info");
  };

  const togglePaid = (id: string) => {
    setCrew((arr) =>
      arr.map((e) => (e.id === id ? { ...e, paid: !e.paid } : e)),
    );
    const e = crew.find((x) => x.id === id);
    if (e)
      pushToast(`${e.name} marked ${e.paid ? "Unpaid" : "Paid"}`, e.paid ? "warn" : "success");
  };

  const generatePayslip = (e: Employee) => {
    const p = payoutForMonth(e);
    const txt = `SERVAA Â· Payslip\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\nEmployee: ${e.name} (${e.id})\nRole: ${e.role}\nMonth: ${new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })}\n\nBase Salary:    ${formatINR(p.base)}\nTips:           ${formatINR(p.tips)}\nHours (week):   ${e.hoursThisWeek}h\nâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€\nTOTAL:          ${formatINR(p.total)}\n\nStatus: ${e.paid ? "PAID" : "UNPAID"}`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payslip-${e.id}-${new Date().toISOString().slice(0, 7)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    pushToast(`Payslip generated for ${e.name}`);
  };

  const updateShift = (
    empId: string,
    day: number,
    slot: ShiftSlot,
    zone: Zone | null,
  ) => {
    setCrew((arr) =>
      arr.map((e) => {
        if (e.id !== empId) return e;
        const others = e.shifts.filter(
          (s) => !(s.day === day && s.slot === slot),
        );
        return {
          ...e,
          shifts:
            zone === null ? others : [...others, { day, slot, zone }],
        };
      }),
    );
  };

  const togglePermission = (role: CrewRole, p: Permission) => {
    setPerms((m) => {
      const arr = m[role] ?? [];
      const next = arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p];
      return { ...m, [role]: next };
    });
  };

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total Staff"
          value={`${kpis.totalActive}`}
          accent="text-gray-900"
          sub={`${crew.filter((e) => e.status === "On Leave").length} on leave`}
        />
        <KpiCard
          icon={Clock}
          label="On Duty Now"
          value={`${kpis.onDuty}`}
          accent="text-emerald-600"
          sub={`Current slot Â· ${kpis.slot}`}
          pulse
        />
        <KpiCard
          icon={Wallet}
          label="Labor Cost %"
          value={`${kpis.laborPct}%`}
          accent={
            kpis.laborPct <= 28
              ? "text-emerald-600"
              : kpis.laborPct <= 35
                ? "text-amber-600"
                : "text-red-600"
          }
          sub={`Of ${formatINR(TOTAL_SALES_DEMO)} sales`}
        />
        <KpiCard
          icon={AlertTriangle}
          label="Shift Gaps"
          value={`${kpis.gaps.length}`}
          accent={kpis.gaps.length > 0 ? "text-red-600" : "text-emerald-600"}
          sub={
            kpis.gaps.length > 0
              ? `Unstaffed: ${kpis.gaps.join(", ")}`
              : "All zones covered"
          }
        />
      </div>

      {/* Tab nav */}
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
                  layoutId="crew-tab-pill"
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

      {tab === "directory" && (
        <DirectoryView
          crew={crew}
          onSetStatus={setStatus}
          onTogglePunch={togglePunch}
        />
      )}
      {tab === "roster" && (
        <RosterView crew={crew} onUpdateShift={updateShift} />
      )}
      {tab === "attendance" && (
        <AttendanceView crew={crew} onTogglePunch={togglePunch} />
      )}
      {tab === "payroll" && (
        <PayrollView
          crew={crew}
          onTogglePaid={togglePaid}
          onPayslip={generatePayslip}
        />
      )}
      {tab === "permissions" && (
        <PermissionsView perms={perms} onToggle={togglePermission} />
      )}

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

/* ---------- KPI ---------- */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-gray-900",
  pulse,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  pulse?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-500">
        <span>{label}</span>
        <Icon className="h-4 w-4 text-gray-300" />
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-2xl font-extrabold ${accent}`}>{value}</span>
        {pulse && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
        )}
      </div>
      {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

/* ============================================================
   DIRECTORY
   ============================================================ */
function DirectoryView({
  crew,
  onSetStatus,
  onTogglePunch,
}: {
  crew: Employee[];
  onSetStatus: (id: string, s: CrewStatus) => void;
  onTogglePunch: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<CrewRole | "All">("All");
  const [active, setActive] = useState<Employee | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crew
      .filter((e) => roleFilter === "All" || e.role === roleFilter)
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [crew, query, roleFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search staff by name, ID, roleâ€¦"
            className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as CrewRole | "All")}
          className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
        >
          <option value="All">All Roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition hover:brightness-110"
          style={{ backgroundColor: "var(--primary-orange)" }}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Employee
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.map((e) => (
          <CrewCard key={e.id} emp={e} onClick={() => setActive(e)} />
        ))}
        {visible.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
            No staff match that filter.
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && (
          <EmployeeDrawer
            emp={active}
            onClose={() => setActive(null)}
            onSetStatus={(s) => onSetStatus(active.id, s)}
            onTogglePunch={() => onTogglePunch(active.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CrewCard({
  emp,
  onClick,
}: {
  emp: Employee;
  onClick: () => void;
}) {
  const initials = emp.name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-orange-200 hover:shadow"
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-base font-extrabold text-white">
            {initials}
          </div>
          {emp.status === "On Duty" && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-gray-900">
            {emp.name}
          </div>
          <div className="font-mono text-[10px] text-gray-400">{emp.id}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${ROLE_TONE[emp.role]}`}
            >
              {emp.role}
            </span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${STATUS_TONE[emp.status]}`}
            >
              {emp.status}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <div className="inline-flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-bold text-gray-800">{emp.rating}</span>
        </div>
        <div className="text-gray-500">
          <strong className="text-gray-900">{emp.hoursThisWeek}h</strong> /
          week
        </div>
        {emp.tipsThisMonth > 0 && (
          <div className="text-emerald-600 font-bold">
            +{formatINR(emp.tipsThisMonth)}
          </div>
        )}
      </div>
    </button>
  );
}

function EmployeeDrawer({
  emp,
  onClose,
  onSetStatus,
  onTogglePunch,
}: {
  emp: Employee;
  onClose: () => void;
  onSetStatus: (s: CrewStatus) => void;
  onTogglePunch: () => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const last = emp.punches[emp.punches.length - 1];
  const isIn = last && !last.outAt;
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
        <header className="flex items-start justify-between border-b border-gray-200 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-lg font-extrabold text-white">
              {emp.name
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <div className="text-base font-extrabold text-gray-900">
                {emp.name}
              </div>
              <div className="font-mono text-[11px] text-gray-500">
                {emp.id}
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${ROLE_TONE[emp.role]}`}
                >
                  {emp.role}
                </span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ring-1 ${STATUS_TONE[emp.status]}`}
                >
                  {emp.status}
                </span>
              </div>
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
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`tel:${emp.phone}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            >
              <Phone className="h-3.5 w-3.5" />
              {emp.phone}
            </a>
            <a
              href={`mailto:${emp.email}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              <Mail className="h-3.5 w-3.5" />
              Email
            </a>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Rating" value={`â˜… ${emp.rating}`} />
            <Stat label="Hours / wk" value={`${emp.hoursThisWeek}h`} />
            <Stat label="Tips" value={formatINR(emp.tipsThisMonth)} />
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Current Session
            </div>
            <div className="mt-0.5 text-base font-bold text-gray-900">
              {isIn ? sessionDuration(last) : "Off the clock"}
            </div>
            {last && (
              <div className="text-[11px] text-gray-500">
                {isIn ? "Clocked in" : "Last clock-in"} at{" "}
                {new Date(last.inAt).toLocaleTimeString()}
              </div>
            )}
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Set Status
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(["On Duty", "Off Duty", "On Leave"] as CrewStatus[]).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onSetStatus(s)}
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ring-1 transition ${
                      emp.status === s
                        ? STATUS_TONE[s]
                        : "bg-white text-gray-500 ring-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              Recent Punches
            </div>
            <ul className="mt-1 divide-y divide-gray-100 rounded-xl border border-gray-200">
              {emp.punches.length === 0 ? (
                <li className="px-3 py-3 text-center text-xs text-gray-400">
                  No punches recorded.
                </li>
              ) : (
                emp.punches
                  .slice()
                  .reverse()
                  .slice(0, 5)
                  .map((p, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <span className="text-gray-700">
                        {new Date(p.inAt).toLocaleString()}
                      </span>
                      <span className="font-bold tabular-nums text-gray-900">
                        {p.outAt
                          ? `${sessionDuration(p)} âœ“`
                          : "Active"}
                      </span>
                    </li>
                  ))
              )}
            </ul>
          </div>
        </div>
        <footer className="border-t border-gray-200 bg-gray-50 p-3">
          <button
            type="button"
            onClick={onTogglePunch}
            className={`flex w-full items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition ${
              isIn ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
            }`}
          >
            {isIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
            {isIn ? "Punch Out" : "Punch In"}
          </button>
        </footer>
      </motion.div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-extrabold text-gray-900">{value}</div>
    </div>
  );
}

/* ============================================================
   ROSTER
   ============================================================ */
function RosterView({
  crew,
  onUpdateShift,
}: {
  crew: Employee[];
  onUpdateShift: (
    empId: string,
    day: number,
    slot: ShiftSlot,
    zone: Zone | null,
  ) => void;
}) {
  const [picker, setPicker] = useState<{
    day: number;
    slot: ShiftSlot;
  } | null>(null);

  const cellAssignments = (day: number, slot: ShiftSlot) => {
    return crew.flatMap((e) =>
      e.shifts
        .filter((s) => s.day === day && s.slot === slot)
        .map((s) => ({ emp: e, zone: s.zone })),
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-3">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">Weekly Roster</h3>
            <span className="ml-auto text-[11px] text-gray-400">
              Click a cell to assign staff to a zone
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="w-32 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Shift
                </th>
                {DAYS.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {SHIFT_SLOTS.map((slot) => (
                <tr key={slot.id} className="align-top">
                  <td className="bg-gray-50/40 px-3 py-2">
                    <div className="text-sm font-bold text-gray-900">
                      {slot.label}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {slot.range}
                    </div>
                  </td>
                  {DAYS.map((_, di) => {
                    const list = cellAssignments(di, slot.id);
                    return (
                      <td key={di} className="border-l border-gray-100 p-1">
                        <button
                          type="button"
                          onClick={() => setPicker({ day: di, slot: slot.id })}
                          className="group flex w-full min-h-[68px] flex-col gap-1 rounded-lg border border-dashed border-gray-200 bg-white p-1.5 text-left transition hover:border-orange-300 hover:bg-orange-50"
                        >
                          {list.length === 0 ? (
                            <div className="flex h-full items-center justify-center text-[10px] text-gray-300">
                              <Plus className="mr-0.5 h-3 w-3" />
                              Assign
                            </div>
                          ) : (
                            list.map(({ emp, zone }) => (
                              <div
                                key={emp.id + zone}
                                className="flex items-center gap-1 rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-800"
                              >
                                <span className="truncate">
                                  {emp.name.split(" ")[0]}
                                </span>
                                <span className="text-orange-500">Â·</span>
                                <span className="truncate">{zone}</span>
                              </div>
                            ))
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {picker && (
          <ShiftPickerModal
            day={picker.day}
            slot={picker.slot}
            crew={crew}
            onClose={() => setPicker(null)}
            onAssign={(empId, zone) =>
              onUpdateShift(empId, picker.day, picker.slot, zone)
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ShiftPickerModal({
  day,
  slot,
  crew,
  onClose,
  onAssign,
}: {
  day: number;
  slot: ShiftSlot;
  crew: Employee[];
  onClose: () => void;
  onAssign: (empId: string, zone: Zone | null) => void;
}) {
  useEffect(() => {
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = o;
    };
  }, []);
  const [empId, setEmpId] = useState<string>(crew[0]?.id ?? "");
  const [zone, setZone] = useState<Zone>("Main Hall");
  const existing = crew.flatMap((e) =>
    e.shifts
      .filter((s) => s.day === day && s.slot === slot)
      .map((s) => ({ emp: e, zone: s.zone })),
  );
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
          className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                Shift Assignment
              </div>
              <h3 className="mt-0.5 text-lg font-extrabold text-gray-900">
                {DAYS[day]} Â· {slot}
              </h3>
              <div className="text-[11px] text-gray-500">
                {SHIFT_SLOTS.find((s) => s.id === slot)?.range}
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
          <div className="space-y-4 p-5">
            {existing.length > 0 && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  Currently Assigned ({existing.length})
                </div>
                <ul className="mt-1 space-y-1">
                  {existing.map(({ emp, zone }) => (
                    <li
                      key={emp.id + zone}
                      className="flex items-center justify-between rounded-md bg-orange-50 px-2 py-1 text-xs ring-1 ring-orange-200"
                    >
                      <span className="font-bold text-orange-800">
                        {emp.name} Â· {zone}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAssign(emp.id, null)}
                        className="rounded p-1 text-orange-500 hover:bg-orange-100 hover:text-red-600"
                        aria-label="Remove"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Add Assignment
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <select
                  value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {crew
                    .filter((e) => e.status !== "On Leave")
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.role})
                      </option>
                    ))}
                </select>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value as Zone)}
                  className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
                >
                  {ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <footer className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => onAssign(empId, zone)}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-sm hover:brightness-110"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              <Check className="h-4 w-4" />
              Assign
            </button>
          </footer>
        </motion.div>
      </div>
    </>
  );
}

/* ============================================================
   ATTENDANCE
   ============================================================ */
function AttendanceView({
  crew,
  onTogglePunch,
}: {
  crew: Employee[];
  onTogglePunch: (id: string) => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const punchedIn = crew.filter((e) => {
    const last = e.punches[e.punches.length - 1];
    return last && !last.outAt;
  });
  const offFloor = crew.filter((e) => {
    const last = e.punches[e.punches.length - 1];
    return !last || last.outAt;
  });

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              On the Floor ({punchedIn.length})
            </h3>
          </div>
          <span className="text-[11px] text-gray-400">
            Live Â· refreshes every 30s
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Staff</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Clock In</th>
                <th className="px-4 py-2">Session</th>
                <th className="px-4 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {punchedIn.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-sm text-gray-400"
                  >
                    Nobody is currently on the floor.
                  </td>
                </tr>
              ) : (
                punchedIn.map((e) => {
                  const last = e.punches[e.punches.length - 1];
                  return (
                    <tr key={e.id} className="hover:bg-emerald-50/30">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                          </span>
                          <div>
                            <div className="text-sm font-bold text-gray-900">
                              {e.name}
                            </div>
                            <div className="font-mono text-[10px] text-gray-400">
                              {e.id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${ROLE_TONE[e.role]}`}
                        >
                          {e.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 tabular-nums text-gray-700">
                        {new Date(last.inAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-2 font-bold tabular-nums text-emerald-700">
                        {sessionDuration(last)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => onTogglePunch(e.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="h-3 w-3" />
                          Punch Out
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

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <ClipboardList className="h-4 w-4 text-gray-400" />
            <h3 className="text-sm font-bold text-gray-900">
              Off the Floor ({offFloor.length})
            </h3>
          </div>
          <span className="text-[11px] text-gray-400">
            Use Manual Punch to correct missed clock-ins
          </span>
        </div>
        <ul className="divide-y divide-gray-100">
          {offFloor.map((e) => {
            const last = e.punches[e.punches.length - 1];
            return (
              <li
                key={e.id}
                className="flex items-center justify-between gap-2 px-4 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <Circle className="h-2.5 w-2.5 fill-gray-300 text-gray-300" />
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {e.name}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {e.role}
                      {last
                        ? ` Â· last out ${new Date(last.outAt!).toLocaleString()}`
                        : " Â· no records today"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onTogglePunch(e.id)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50"
                >
                  <Pencil className="h-3 w-3" />
                  Manual Punch In
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ============================================================
   PAYROLL
   ============================================================ */
function PayrollView({
  crew,
  onTogglePaid,
  onPayslip,
}: {
  crew: Employee[];
  onTogglePaid: (id: string) => void;
  onPayslip: (e: Employee) => void;
}) {
  const totals = useMemo(() => {
    let base = 0,
      tips = 0,
      paid = 0,
      unpaid = 0;
    crew.forEach((e) => {
      base += e.baseSalary;
      tips += e.tipsThisMonth;
      if (e.paid) paid += e.baseSalary + e.tipsThisMonth;
      else unpaid += e.baseSalary + e.tipsThisMonth;
    });
    return { base, tips, paid, unpaid, total: base + tips };
  }, [crew]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Total Payroll"
          value={formatINR(totals.total)}
          accent="text-gray-900"
          sub={`${crew.length} employees`}
        />
        <KpiCard
          icon={Wallet}
          label="Base Salaries"
          value={formatINR(totals.base)}
          accent="text-gray-900"
        />
        <KpiCard
          icon={Wallet}
          label="Tip Pool"
          value={formatINR(totals.tips)}
          accent="text-emerald-600"
          sub="from FOH ledger"
        />
        <KpiCard
          icon={Wallet}
          label="Outstanding"
          value={formatINR(totals.unpaid)}
          accent={totals.unpaid > 0 ? "text-red-600" : "text-emerald-600"}
          sub={`${formatINR(totals.paid)} paid`}
        />
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-bold text-gray-900">
            {new Date().toLocaleString("en-IN", {
              month: "long",
              year: "numeric",
            })}{" "}
            Â· Earnings Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2 text-right">Base</th>
                <th className="px-4 py-2 text-right">Tips</th>
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {crew.map((e) => {
                const p = payoutForMonth(e);
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="text-sm font-bold text-gray-900">
                        {e.name}
                      </div>
                      <div className="font-mono text-[10px] text-gray-400">
                        {e.id}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${ROLE_TONE[e.role]}`}
                      >
                        {e.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-gray-700">
                      {formatINR(p.base)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums text-emerald-700">
                      {p.tips > 0 ? `+${formatINR(p.tips)}` : "â€”"}
                    </td>
                    <td className="px-4 py-2 text-right font-extrabold tabular-nums text-gray-900">
                      {formatINR(p.total)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onTogglePaid(e.id)}
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 transition ${
                          e.paid
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
                            : "bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100"
                        }`}
                      >
                        {e.paid ? (
                          <CheckCircle2 className="h-3 w-3" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                        {e.paid ? "Paid" : "Unpaid"}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onPayslip(e)}
                        className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
                      >
                        <FileText className="h-3 w-3" />
                        Payslip
                      </button>
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
   PERMISSIONS
   ============================================================ */
function PermissionsView({
  perms,
  onToggle,
}: {
  perms: Record<CrewRole, Permission[]>;
  onToggle: (role: CrewRole, p: Permission) => void;
}) {
  const groups = Array.from(new Set(ALL_PERMISSIONS.map((p) => p.group)));
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-4">
        <div className="flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900">
            Role-Based Permissions
          </h3>
        </div>
        <p className="mt-1 text-[11px] text-gray-500">
          Toggle what each role can see and do across the app. Admins always
          have full access.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <th className="px-4 py-2">Permission</th>
              {ROLES.map((r) => (
                <th
                  key={r}
                  className="px-2 py-2 text-center text-[10px]"
                  title={r}
                >
                  <span
                    className={`inline-block rounded-full px-1.5 py-0.5 ring-1 ${ROLE_TONE[r]}`}
                  >
                    {r}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {groups.map((g) => (
              <>
                <tr key={`hdr-${g}`} className="bg-gray-50/40">
                  <td
                    colSpan={ROLES.length + 1}
                    className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {g}
                  </td>
                </tr>
                {ALL_PERMISSIONS.filter((p) => p.group === g).map((p) => (
                  <tr key={p.id} className="hover:bg-orange-50/30">
                    <td className="px-4 py-2 font-semibold text-gray-800">
                      {p.label}
                    </td>
                    {ROLES.map((r) => {
                      const on = perms[r]?.includes(p.id);
                      const isAdmin = r === "Admin";
                      return (
                        <td
                          key={r}
                          className="px-2 py-2 text-center"
                        >
                          <button
                            type="button"
                            disabled={isAdmin}
                            onClick={() => onToggle(r, p.id)}
                            className={`relative h-5 w-9 rounded-full transition ${
                              on
                                ? "bg-emerald-500"
                                : "bg-gray-200 hover:bg-gray-300"
                            } ${isAdmin ? "cursor-not-allowed opacity-70" : ""}`}
                            aria-label={`${r} can ${p.label}`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                                on ? "left-[18px]" : "left-0.5"
                              }`}
                            />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const __unused = { Pencil };
