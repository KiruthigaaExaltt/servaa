import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  SEED_CUSTOMERS,
  type Customer,
  type FeedbackEntry,
} from "@/lib/crmData";
import { useCollectionState } from "@/lib/collectionState";
import { commitCustomerFeedback } from "@/lib/workflowsApi";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Collapse to the last 10 digits so "+91 98765 43210" and "9876543210"
  // resolve to the same customer (India numbering).
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export interface NewCustomerInput {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
}

interface CRMContextValue {
  customers: Customer[];
  findCustomerByPhone: (phone: string) => Customer | undefined;
  addCustomer: (input: NewCustomerInput) => Customer;
  recordVisit: (phone: string, spend: number, pointsEarned: number) => void;
  addFeedback: (
    phone: string,
    entry: Omit<FeedbackEntry, "id" | "at">,
  ) => void;
}

const CRMContext = createContext<CRMContextValue | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useCollectionState<Customer[]>("crm_customers", SEED_CUSTOMERS);

  const findCustomerByPhone = useCallback(
    (phone: string): Customer | undefined => {
      const target = normalizePhone(phone);
      if (target.length < 6) return undefined;
      return customers.find((c) => normalizePhone(c.phone) === target);
    },
    [customers],
  );

  const addCustomer = useCallback((input: NewCustomerInput): Customer => {
    const target = normalizePhone(input.phone);
    let result: Customer | undefined;
    setCustomers((prev) => {
      const existing = prev.find((c) => normalizePhone(c.phone) === target);
      if (existing) {
        result = existing;
        return prev;
      }
      const created: Customer = {
        id: `C-${Date.now()}`,
        name: input.name.trim() || "Walk-in Guest",
        phone: input.phone,
        email: input.email,
        joinedAt: new Date().toISOString().slice(0, 10),
        visits: 0,
        lifetimeSpend: 0,
        points: 0,
        lastVisitAt: Date.now(),
        tags: input.tags ?? ["New"],
      };
      result = created;
      return [created, ...prev];
    });
    return (
      result ?? {
        id: `C-${Date.now()}`,
        name: input.name,
        phone: input.phone,
        joinedAt: new Date().toISOString().slice(0, 10),
        visits: 0,
        lifetimeSpend: 0,
        points: 0,
        lastVisitAt: Date.now(),
        tags: input.tags ?? ["New"],
      }
    );
  }, []);

  const recordVisit = useCallback(
    (phone: string, spend: number, pointsEarned: number) => {
      const target = normalizePhone(phone);
      if (target.length < 6) return;
      setCustomers((prev) =>
        prev.map((c) =>
          normalizePhone(c.phone) === target
            ? {
                ...c,
                visits: c.visits + 1,
                lifetimeSpend: c.lifetimeSpend + Math.max(0, spend),
                points: c.points + Math.max(0, pointsEarned),
                lastVisitAt: Date.now(),
              }
            : c,
        ),
      );
    },
    [],
  );

  const addFeedback = useCallback(
    (phone: string, entry: Omit<FeedbackEntry, "id" | "at">) => {
      const target = normalizePhone(phone);
      if (target.length < 6) return;
      const full: FeedbackEntry = {
        ...entry,
        id: `fb-${Date.now()}`,
        at: Date.now(),
      };
      void commitCustomerFeedback(phone, full);
      setCustomers((prev) =>
        prev.map((c) =>
          normalizePhone(c.phone) === target
            ? { ...c, feedback: [full, ...(c.feedback ?? [])] }
            : c,
        ),
      );
    },
    [],
  );

  const value = useMemo<CRMContextValue>(
    () => ({
      customers,
      findCustomerByPhone,
      addCustomer,
      recordVisit,
      addFeedback,
    }),
    [customers, findCustomerByPhone, addCustomer, recordVisit, addFeedback],
  );

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export function useCRM(): CRMContextValue {
  const ctx = useContext(CRMContext);
  if (!ctx) throw new Error("useCRM must be used within a CRMProvider");
  return ctx;
}
