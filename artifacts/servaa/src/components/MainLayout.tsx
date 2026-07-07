import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ShieldAlert, KeyRound, Lock } from "lucide-react";
import { TopNav } from "./TopNav";
import { KDSManagement } from "./KDSManagement";
import { FOHManagement } from "./FOHManagement";
import { InventoryManagement } from "./InventoryManagement";
import { OrdersManagement } from "./OrdersManagement";
import { TablesManagement } from "./TablesManagement";
import { MenuManagement } from "./MenuManagement";
import { BOHManagement } from "./BOHManagement";
import { DeliveryManagement } from "./DeliveryManagement";
import { CrewManagement } from "./CrewManagement";
import { CRMLoyalty } from "./CRMLoyalty";
import { ReportsAnalytics } from "./ReportsAnalytics";
import { AccountsManagement } from "./AccountsManagement";
import { Dashboard } from "./Dashboard";
import { SettingsHub } from "./SettingsHub";
import { AuditLog } from "./AuditLog";
import { EndOfDay } from "./EndOfDay";
import { StaffClock } from "./StaffClock";
import { MODULES, type ModuleId } from "@/lib/modules";
import { useRole } from "@/context/RoleContext";

/* ─── Admin Override PIN Modal ─────────────────────────────────────────── */

const MAX_ATTEMPTS = 3;
const LOCKOUT_SEC = 30;

function AdminPinModal() {
  const {
    overrideState,
    cancelOverride,
    submitOverride,
    pinAttempts,
    pinLockedUntil,
  } = useRole();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (overrideState) {
      setPin("");
      setShake(false);
    }
  }, [overrideState]);

  if (!overrideState) return null;

  const isLocked = now < pinLockedUntil;
  const secondsLeft = isLocked ? Math.ceil((pinLockedUntil - now) / 1000) : 0;
  const attemptsLeft = MAX_ATTEMPTS - pinAttempts;

  const onSubmit = async () => {
    if (isLocked) return;
    const ok = await submitOverride(pin);
    if (!ok) {
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setPin("");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm"
        onClick={isLocked ? undefined : cancelOverride}
      />
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ type: "spring", stiffness: 400, damping: 28 }}
        className="fixed inset-0 z-[201] flex items-center justify-center p-4"
      >
        <motion.div
          animate={shake ? { x: [0, -8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-gray-900 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
              {isLocked ? (
                <Lock className="h-5 w-5 text-red-400" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-400" />
              )}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white">
                {isLocked ? "PIN Locked" : "Admin Override Required"}
              </h2>
              <p className="text-xs text-gray-400">{overrideState.action}</p>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-4 p-5">
            {isLocked ? (
              <div className="rounded-lg bg-red-50 p-4 text-center">
                <p className="text-sm font-bold text-red-700">
                  Too many incorrect attempts
                </p>
                <p className="mt-1 text-xs text-red-600">
                  Locked for{" "}
                  <span className="tabular-nums font-mono">{secondsLeft}s</span>
                  {secondsLeft > 1 ? "" : "…"}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Enter Admin PIN
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-orange-400 focus-within:ring-2 focus-within:ring-orange-100">
                  <KeyRound className="h-4 w-4 text-gray-400" />
                  <input
                    autoFocus
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && onSubmit()}
                    placeholder="••••"
                    className="flex-1 bg-transparent text-center text-lg font-extrabold tracking-widest text-gray-900 outline-none placeholder:text-gray-300"
                  />
                </div>
                {pinAttempts > 0 && (
                  <p className="text-center text-xs font-semibold text-amber-600">
                    {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining before lockout
                  </p>
                )}
              </div>
            )}

            {shake && !isLocked && (
              <p className="text-center text-xs font-semibold text-red-500">
                Incorrect PIN — try again
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-2 border-t border-gray-100 px-5 pb-5">
            <button
              type="button"
              onClick={cancelOverride}
              className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isLocked}
              onClick={onSubmit}
              className="flex-1 rounded-lg py-2 text-sm font-bold text-white shadow-sm disabled:opacity-40"
              style={{ backgroundColor: "var(--primary-orange)" }}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ─── Main Layout ──────────────────────────────────────────────────────── */

const MODULES_WITH_OWN_HEADER: ModuleId[] = [
  "kot-kds", "foh", "inventory", "orders-billing", "tables", "menu",
  "boh", "delivery", "crew", "crm-loyalty", "reports", "accounts",
  "dashboard", "settings",
];

export function MainLayout() {
  const { allowedModules } = useRole();
  const [active, setActive] = useState<ModuleId>(allowedModules[0]);

  useEffect(() => {
    if (!allowedModules.includes(active)) {
      setActive(allowedModules[0]);
    }
  }, [allowedModules, active]);

  const current = MODULES.find((m) => m.id === active) ?? MODULES[0];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopNav active={active} onChange={setActive} />
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {current.label}
            </h1>
            {!MODULES_WITH_OWN_HEADER.includes(active) && (
              <p className="mt-1 text-sm text-gray-500">
                Module placeholder — content for{" "}
                <span className="font-medium text-gray-700">
                  {current.label}
                </span>{" "}
                will appear here.
              </p>
            )}
          </div>

          {active === "dashboard" ? (
            <Dashboard />
          ) : active === "kot-kds" ? (
            <KDSManagement />
          ) : active === "foh" ? (
            <FOHManagement />
          ) : active === "inventory" ? (
            <InventoryManagement />
          ) : active === "orders-billing" ? (
            <OrdersManagement onNavigate={setActive} />
          ) : active === "tables" ? (
            <TablesManagement />
          ) : active === "menu" ? (
            <MenuManagement />
          ) : active === "boh" ? (
            <BOHManagement />
          ) : active === "delivery" ? (
            <DeliveryManagement />
          ) : active === "crew" ? (
            <StaffClock />
          ) : active === "crm-loyalty" ? (
            <CRMLoyalty />
          ) : active === "reports" ? (
            <ReportsAnalytics />
          ) : active === "accounts" ? (
            <AccountsManagement />
          ) : active === "settings" ? (
            <SettingsHub />
          ) : (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-400">
              {current.label}
            </div>
          )}

          {/* Utility panel shortcuts */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AuditLog />
            <EndOfDay />
          </div>
        </div>
      </main>

      <AdminPinModal />
    </div>
  );
}
