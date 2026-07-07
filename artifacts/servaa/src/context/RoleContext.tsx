import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ModuleId } from "@/lib/modules";
import { verifyAdminPin } from "@/lib/authApi";

export type UserRole = "Admin" | "Manager" | "Cashier" | "Server" | "Kitchen";

export type Permission =
  | "send_kot"
  | "generate_bill"
  | "settle_payment"
  | "pull_back_bill"
  | "delete_row"
  | "view_reports"
  | "manage_accounts"
  | "manage_inventory"
  | "manage_menu"
  | "manage_crew"
  | "manage_settings"
  | "manage_crm"
  | "admin_override";

const ALL_MODULE_IDS: ModuleId[] = [
  "dashboard",
  "tables",
  "foh",
  "menu",
  "kot-kds",
  "inventory",
  "boh",
  "delivery",
  "orders-billing",
  "crew",
  "accounts",
  "crm-loyalty",
  "reports",
  "settings",
];

export const ROLE_MODULES: Record<UserRole, ModuleId[]> = {
  Admin: ALL_MODULE_IDS,
  Manager: ALL_MODULE_IDS,
  Cashier: ["dashboard", "foh", "orders-billing", "accounts"],
  Server: ["foh", "tables", "dashboard"],
  Kitchen: ["kot-kds"],
};

const ALL_PERMS: Permission[] = [
  "send_kot",
  "generate_bill",
  "settle_payment",
  "pull_back_bill",
  "delete_row",
  "view_reports",
  "manage_accounts",
  "manage_inventory",
  "manage_menu",
  "manage_crew",
  "manage_settings",
  "manage_crm",
  "admin_override",
];

export const ROLE_PERMS: Record<UserRole, Permission[]> = {
  Admin: ALL_PERMS,
  Manager: ALL_PERMS,
  Cashier: ["send_kot", "generate_bill", "settle_payment"],
  Server: ["send_kot", "generate_bill"],
  Kitchen: [],
};

export const ROLE_BADGE: Record<UserRole, string> = {
  Admin: "bg-red-100 text-red-700 ring-red-300",
  Manager: "bg-purple-100 text-purple-700 ring-purple-300",
  Cashier: "bg-blue-100 text-blue-700 ring-blue-300",
  Server: "bg-emerald-100 text-emerald-700 ring-emerald-300",
  Kitchen: "bg-amber-100 text-amber-700 ring-amber-300",
};

const ELEVATED_ROLES: UserRole[] = ["Admin", "Manager", "Cashier"];
const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_MS = 30_000;

export interface OverrideState {
  action: string;
  onSuccess: () => void;
}

interface RoleContextValue {
  role: UserRole;
  setRole: (r: UserRole) => void;
  can: (p: Permission) => boolean;
  allowedModules: ModuleId[];
  overrideState: OverrideState | null;
  requestOverride: (action: string, onSuccess: () => void) => void;
  cancelOverride: () => void;
  submitOverride: (pin: string) => Promise<boolean>;
  pinAttempts: number;
  pinLockedUntil: number;
  requestRoleChange: (newRole: UserRole) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>("Admin");
  const [overrideState, setOverrideState] = useState<OverrideState | null>(null);
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState(0);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);

  const can = useCallback(
    (p: Permission) => ROLE_PERMS[role].includes(p),
    [role],
  );

  const allowedModules = useMemo(() => ROLE_MODULES[role], [role]);

  const requestOverride = useCallback(
    (action: string, onSuccess: () => void) => {
      setOverrideState({ action, onSuccess });
    },
    [],
  );

  const cancelOverride = useCallback(() => {
    setOverrideState(null);
    setPendingRole(null);
  }, []);

  const submitOverride = useCallback(
    async (pin: string): Promise<boolean> => {
      if (Date.now() < pinLockedUntil) return false;

      if (await verifyAdminPin(pin)) {
        setPinAttempts(0);
        if (pendingRole) {
          setRoleState(pendingRole);
          setPendingRole(null);
        }
        overrideState?.onSuccess();
        setOverrideState(null);
        return true;
      }

      const newAttempts = pinAttempts + 1;
      if (newAttempts >= MAX_PIN_ATTEMPTS) {
        setPinLockedUntil(Date.now() + LOCKOUT_MS);
        setPinAttempts(0);
      } else {
        setPinAttempts(newAttempts);
      }
      return false;
    },
    [overrideState, pinAttempts, pinLockedUntil, pendingRole],
  );

  const requestRoleChange = useCallback(
    (newRole: UserRole) => {
      if (newRole === role) return;
      if (ELEVATED_ROLES.includes(newRole)) {
        setPendingRole(newRole);
        setOverrideState({
          action: `Switch to ${newRole} — enter Admin PIN`,
          onSuccess: () => {
            setRoleState(newRole);
            setPendingRole(null);
          },
        });
      } else {
        setRoleState(newRole);
      }
    },
    [role],
  );

  const setRole = useCallback(
    (r: UserRole) => {
      requestRoleChange(r);
    },
    [requestRoleChange],
  );

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole,
        can,
        allowedModules,
        overrideState,
        requestOverride,
        cancelOverride,
        submitOverride,
        pinAttempts,
        pinLockedUntil,
        requestRoleChange,
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
