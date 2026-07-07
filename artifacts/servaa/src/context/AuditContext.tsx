import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import { useCollectionState } from "@/lib/collectionState";
import type { UserRole } from "./RoleContext";

export interface AuditEntry {
  id: string;
  at: number;
  role: UserRole;
  actor: string;
  action: string;
  detail: string;
  module: string;
}

interface AuditContextValue {
  entries: AuditEntry[];
  logAction: (entry: Omit<AuditEntry, "id" | "at"> & { id?: string }) => void;
}

const AuditContext = createContext<AuditContextValue | null>(null);

let auditSeq = 0;

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useCollectionState<AuditEntry[]>("audit_log", []);

  const logAction = useCallback(
    (entry: Omit<AuditEntry, "id" | "at"> & { id?: string }) => {
      auditSeq += 1;
      const full: AuditEntry = {
        ...entry,
        id: entry.id ?? `AUD-${Date.now()}-${auditSeq}`,
        at: Date.now(),
      };
      setEntries((prev) => [full, ...prev].slice(0, 1000));
    },
    [setEntries],
  );

  return (
    <AuditContext.Provider value={{ entries, logAction }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit(): AuditContextValue {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error("useAudit must be used within AuditProvider");
  return ctx;
}
