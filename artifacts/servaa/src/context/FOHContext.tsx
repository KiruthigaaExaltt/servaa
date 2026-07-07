import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { lineUnitPrice, type CartLine } from "@/lib/cart";
import { useSettings } from "./SettingsContext";
import { useCollectionState } from "@/lib/collectionState";
import {
  SEED_QRS,
  SEED_RESERVATIONS,
  SEED_TABLES,
  SEED_TIPS,
  SEED_WAITLIST,
  type FloorTable,
  type QRCard,
  type Reservation,
  type TableStatus,
  type TipEntry,
  type TipPaymentMethod,
  type WaitlistEntry,
} from "@/lib/fohData";
import type { OrderSource, OrderType } from "@/types";

export interface OrderMeta {
  orderType: OrderType;
  tableId: string;
  pax: number;
  customerName: string;
  customerPhone: string;
  waiterName: string;
  orderSource: OrderSource;
}

const DEFAULT_META: OrderMeta = {
  orderType: "Dine In",
  tableId: "T-1",
  pax: 2,
  customerName: "",
  customerPhone: "",
  waiterName: "Anita",
  orderSource: "Walk-In",
};

export type PaymentMethod = "Cash" | "Card" | "UPI" | "Wallet";

export interface CompletedOrder {
  id: string;
  timestamp: number;
  invoiceNumber?: string;
  meta: OrderMeta;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered?: number;
  changeReturned?: number;
}

export interface PendingBill {
  tableId: string;
  meta: OrderMeta;
  lines: CartLine[];
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  total: number;
  generatedAt: number;
}

interface FOHContextValue {
  // Tables
  tables: FloorTable[];
  setTableStatus: (tableId: string, status: TableStatus, patch?: Partial<FloorTable>) => void;

  // Held carts (per table)
  heldCarts: Record<string, CartLine[]>;
  heldMeta: Record<string, OrderMeta>;

  // Completed transactions (for reporting)
  completedOrders: CompletedOrder[];
  logCompletedOrder: (order: Omit<CompletedOrder, "id" | "timestamp">) => CompletedOrder;
  settledTables: Set<string>;

  // Two-stage billing (bill generated, awaiting settlement)
  pendingBills: Record<string, PendingBill>;
  generateBill: (bill: Omit<PendingBill, "generatedAt">) => void;
  settlePendingBill: (
    tableId: string,
    payment: { method: PaymentMethod; amountTendered?: number; changeReturned?: number },
  ) => CompletedOrder | undefined;
  cancelPendingBill: (tableId: string) => void;

  // Unified command-center helpers (Orders & Live Billing):
  // pull any ongoing session (held cart or awaiting-settlement bill) back into
  // the active FOH editing workspace for modificationâ€¦
  recallToWorkspace: (tableId: string) => void;
  // â€¦or close it out directly, computing totals for still-eating tables.
  settleOngoing: (
    tableId: string,
    payment: { method: PaymentMethod; amountTendered?: number; changeReturned?: number },
    invoiceNumber?: string,
  ) => CompletedOrder | undefined;

  // Active editing session
  cart: CartLine[];
  setCart: React.Dispatch<React.SetStateAction<CartLine[]>>;
  meta: OrderMeta;
  updateMeta: (patch: Partial<OrderMeta>) => void;

  // Actions
  selectTable: (tableId: string) => void; // load held cart if any, else fresh
  holdCart: () => void;
  settleCart: () => void;
  commitSentCart: (lines: CartLine[]) => void;

  // Reservations
  reservations: Reservation[];
  seatReservation: (reservationId: string, tableId: string) => void;
  addReservation: (r: Omit<Reservation, "id" | "status"> & { status?: Reservation["status"] }) => void;
  updateReservation: (id: string, patch: Partial<Reservation>) => void;
  deleteReservation: (id: string) => void;

  // Waitlist
  waitlist: WaitlistEntry[];
  addWaitlistEntry: (w: Omit<WaitlistEntry, "id" | "joinedAt">) => void;
  removeWaitlistEntry: (id: string) => void;
  promoteWaitlistEntry: (id: string) => void;

  // Tips
  tips: TipEntry[];
  addTip: (entry: Omit<TipEntry, "id" | "time">) => void;
  deleteTip: (id: string) => void;

  // QR
  qrs: QRCard[];
  regenerateQR: (tableId: string) => void;
  updateAllQRMenuVersion: (version: string) => void;
}

const FOHContext = createContext<FOHContextValue | undefined>(undefined);

export function FOHProvider({ children }: { children: ReactNode }) {
  const { tax } = useSettings();
  const [tables, setTables] = useCollectionState<FloorTable[]>("foh_tables", SEED_TABLES);
  const [heldCarts, setHeldCarts] = useCollectionState<Record<string, CartLine[]>>("foh_held_carts", {});
  const [heldMeta, setHeldMeta] = useCollectionState<Record<string, OrderMeta>>("foh_held_meta", {});
  const [cart, setCart] = useState<CartLine[]>([]);
  const [meta, setMeta] = useState<OrderMeta>(DEFAULT_META);
  const [completedOrders, setCompletedOrders] = useCollectionState<CompletedOrder[]>("foh_completed_orders", []);
  const [pendingBills, setPendingBills] = useCollectionState<Record<string, PendingBill>>("foh_pending_bills", {});
  const [reservations, setReservations] = useCollectionState<Reservation[]>("foh_reservations", SEED_RESERVATIONS);
  const [waitlist, setWaitlist] = useCollectionState<WaitlistEntry[]>("foh_waitlist", SEED_WAITLIST);
  const [tips, setTips] = useCollectionState<TipEntry[]>("foh_tips", SEED_TIPS);
  const [qrs, setQRs] = useCollectionState<QRCard[]>("foh_qrs", SEED_QRS);
  const [settledTables, setSettledTables] = useState<Set<string>>(new Set());

  const setTableStatus: FOHContextValue["setTableStatus"] = useCallback(
    (tableId, status, patch) => {
      setTables((prev) =>
        prev.map((t) =>
          t.id === tableId
            ? {
                ...t,
                status,
                ...patch,
                ...(status === "Vacant" || status === "Cleaning"
                  ? { pax: undefined, waiterName: undefined, customerName: undefined, occupiedSince: undefined }
                  : {}),
              }
            : t,
        ),
      );
    },
    [],
  );

  const updateMeta = useCallback((patch: Partial<OrderMeta>) => {
    setMeta((prev) => ({ ...prev, ...patch }));
  }, []);

  const selectTable = useCallback(
    (tableId: string) => {
      // Re-opening the table that's already active â€” keep the live session
      // exactly as-is (never clear or roll back to an older snapshot).
      if (tableId === meta.tableId) return;

      const outgoing = meta.tableId;
      const outgoingCart = cart;
      const outgoingMeta = meta;
      // Preserve the table we're leaving so its live session is recallable.
      const saveOutgoing = outgoingCart.length > 0;
      const held = heldCarts[tableId];
      const heldM = heldMeta[tableId];

      setHeldCarts((prev) => {
        const next = { ...prev };
        if (saveOutgoing) next[outgoing] = outgoingCart;
        delete next[tableId];
        return next;
      });
      setHeldMeta((prev) => {
        const next = { ...prev };
        if (saveOutgoing) next[outgoing] = outgoingMeta;
        delete next[tableId];
        return next;
      });

      if (held) {
        setCart(held);
        setMeta({ ...DEFAULT_META, ...heldM, tableId, orderType: "Dine In" });
      } else {
        // Fresh table â€” start a clean session.
        setCart([]);
        setMeta((prev) => ({
          ...prev,
          tableId,
          orderType: "Dine In",
          customerName: "",
          customerPhone: "",
        }));
      }
    },
    [cart, meta, heldCarts, heldMeta],
  );

  const holdCart = useCallback(() => {
    if (cart.length === 0) return;
    const tid = meta.tableId;
    setHeldCarts((prev) => ({ ...prev, [tid]: cart }));
    setHeldMeta((prev) => ({ ...prev, [tid]: meta }));
    setTableStatus(tid, "Occupied", {
      pax: meta.pax,
      waiterName: meta.waiterName,
      customerName: meta.customerName || "Walk-in",
      occupiedSince: Date.now(),
    });
    setCart([]);
  }, [cart, meta, setTableStatus]);

  const settleCart = useCallback(() => {
    const tid = meta.tableId;
    setHeldCarts((prev) => {
      const next = { ...prev };
      delete next[tid];
      return next;
    });
    setHeldMeta((prev) => {
      const next = { ...prev };
      delete next[tid];
      return next;
    });
    if (meta.orderType === "Dine In") {
      setTableStatus(tid, "Cleaning");
    }
    setCart([]);
  }, [meta, setTableStatus]);

  // Continuous KOT loop: after firing items to the kitchen, keep the (now
  // partially-sent) cart as the table's live session instead of wiping it.
  // The table stays Occupied and accessible; reopening it recalls these lines.
  const commitSentCart = useCallback(
    (lines: CartLine[]) => {
      const tid = meta.tableId;
      setCart(lines);
      setHeldCarts((prev) => ({ ...prev, [tid]: lines }));
      setHeldMeta((prev) => ({ ...prev, [tid]: meta }));
      const existing = tables.find((t) => t.id === tid);
      setTableStatus(tid, "Occupied", {
        pax: meta.pax,
        waiterName: meta.waiterName,
        customerName: meta.customerName || "Walk-in",
        occupiedSince: existing?.occupiedSince ?? Date.now(),
      });
    },
    [meta, tables, setTableStatus],
  );

  const seatReservation = useCallback(
    (reservationId: string, tableId: string) => {
      let res: Reservation | undefined;
      setReservations((prev) =>
        prev.map((r) => {
          if (r.id !== reservationId) return r;
          res = r;
          return { ...r, status: "Seated", seatedTableId: tableId };
        }),
      );
      if (res) {
        setTableStatus(tableId, "Occupied", {
          pax: res.pax,
          waiterName: "Unassigned",
          customerName: res.guestName,
          occupiedSince: Date.now(),
        });
      }
    },
    [setTableStatus],
  );

  const addReservation = useCallback(
    (r: Omit<Reservation, "id" | "status"> & { status?: Reservation["status"] }) => {
      setReservations((prev) => [
        { id: `r-${Date.now()}`, status: r.status ?? "Confirmed", ...r },
        ...prev,
      ]);
    },
    [],
  );

  const updateReservation = useCallback(
    (id: string, patch: Partial<Reservation>) => {
      setReservations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const deleteReservation = useCallback((id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addWaitlistEntry = useCallback(
    (w: Omit<WaitlistEntry, "id" | "joinedAt">) => {
      setWaitlist((prev) => [
        ...prev,
        { id: `w-${Date.now()}`, joinedAt: Date.now(), ...w },
      ]);
    },
    [],
  );

  const removeWaitlistEntry = useCallback((id: string) => {
    setWaitlist((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const promoteWaitlistEntry = useCallback((id: string) => {
    let entry: WaitlistEntry | undefined;
    setWaitlist((prev) => {
      entry = prev.find((w) => w.id === id);
      return prev.filter((w) => w.id !== id);
    });
    if (entry) {
      setReservations((prev) => [
        {
          id: `r-${Date.now()}`,
          guestName: entry!.guestName,
          phone: entry!.phone,
          pax: entry!.pax,
          date: new Date().toISOString().slice(0, 10),
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }),
          status: "Confirmed",
          note: entry!.note,
        },
        ...prev,
      ]);
    }
  }, []);

  const addTip = useCallback((entry: Omit<TipEntry, "id" | "time">) => {
    if (!entry.staff.trim() || entry.amount <= 0) return;
    setTips((prev) => [
      { id: `tip-${Date.now()}`, time: Date.now(), ...entry, staff: entry.staff.trim() },
      ...prev,
    ]);
  }, []);

  const deleteTip = useCallback((id: string) => {
    setTips((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const updateAllQRMenuVersion = useCallback((version: string) => {
    setQRs((prev) => prev.map((q) => ({ ...q, menuVersion: version })));
  }, []);

  const regenerateQR = useCallback((tableId: string) => {
    setQRs((prev) =>
      prev.map((q) =>
        q.tableId === tableId
          ? {
              ...q,
              code: `SRV-${tableId.replace("T-", "").padStart(3, "0")}-${Math.floor(
                Math.random() * 0xfffff,
              )
                .toString(16)
                .toUpperCase()
                .padStart(4, "0")}`,
              lastUsed: Date.now(),
            }
          : q,
      ),
    );
  }, []);

  const logCompletedOrder = useCallback(
    (order: Omit<CompletedOrder, "id" | "timestamp">): CompletedOrder => {
      const ts = Date.now();
      const full: CompletedOrder = {
        ...order,
        id: `txn-${ts}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: ts,
      };
      setCompletedOrders((prev) => [full, ...prev]);
      return full;
    },
    [setCompletedOrders],
  );

  const generateBill = useCallback(
    (bill: Omit<PendingBill, "generatedAt">) => {
      setPendingBills((prev) => ({
        ...prev,
        [bill.tableId]: { ...bill, generatedAt: Date.now() },
      }));
      setHeldCarts((prev) => {
        const next = { ...prev };
        delete next[bill.tableId];
        return next;
      });
      setHeldMeta((prev) => {
        const next = { ...prev };
        delete next[bill.tableId];
        return next;
      });
      setTableStatus(bill.tableId, "Waiting for Settlement", {
        pax: bill.meta.pax,
        waiterName: bill.meta.waiterName,
        customerName: bill.meta.customerName || "Walk-in",
      });
      setCart([]);
    },
    [setTableStatus],
  );

  const settlePendingBill = useCallback(
    (
      tableId: string,
      payment: { method: PaymentMethod; amountTendered?: number; changeReturned?: number },
    ): CompletedOrder | undefined => {
      const bill = pendingBills[tableId];
      if (!bill) return undefined;
      const txn = logCompletedOrder({
        meta: bill.meta,
        lines: bill.lines,
        subtotal: bill.subtotal,
        discount: bill.discount,
        cgst: bill.cgst,
        sgst: bill.sgst,
        total: bill.total,
        paymentMethod: payment.method,
        amountTendered: payment.amountTendered,
        changeReturned: payment.changeReturned,
      });
      setPendingBills((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      setTableStatus(tableId, "Cleaning");
      return txn;
    },
    [pendingBills, logCompletedOrder, setTableStatus],
  );

  const cancelPendingBill = useCallback(
    (tableId: string) => {
      const bill = pendingBills[tableId];
      if (!bill) return;
      setHeldCarts((prev) => ({ ...prev, [tableId]: bill.lines }));
      setHeldMeta((prev) => ({ ...prev, [tableId]: bill.meta }));
      setPendingBills((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      setTableStatus(tableId, "Occupied", {
        pax: bill.meta.pax,
        waiterName: bill.meta.waiterName,
        customerName: bill.meta.customerName || "Walk-in",
      });
    },
    [pendingBills, setTableStatus],
  );

  // Pull an ongoing session back into the live editing workspace. Works for both
  // still-eating tables (held cart) and awaiting-settlement tables (pending bill);
  // for the latter it also unlocks the bill (undoes the settlement hold).
  const recallToWorkspace = useCallback(
    (tableId: string) => {
      const bill = pendingBills[tableId];
      const lines = bill ? bill.lines : heldCarts[tableId] ?? [];
      const targetMeta = bill ? bill.meta : heldMeta[tableId];

      // Preserve the currently-open table's live session so it stays recallable.
      const outgoing = meta.tableId;
      const saveOutgoing = outgoing !== tableId && cart.length > 0;
      const outgoingCart = cart;
      const outgoingMeta = meta;

      setHeldCarts((prev) => {
        const next = { ...prev };
        if (saveOutgoing) next[outgoing] = outgoingCart;
        delete next[tableId];
        return next;
      });
      setHeldMeta((prev) => {
        const next = { ...prev };
        if (saveOutgoing) next[outgoing] = outgoingMeta;
        delete next[tableId];
        return next;
      });
      if (bill) {
        setPendingBills((prev) => {
          const next = { ...prev };
          delete next[tableId];
          return next;
        });
      }

      // Load the recalled session into the active editing workspace directly
      // (bypasses selectTable's same-table no-op guard).
      setCart(lines);
      setMeta((prev) => ({
        ...DEFAULT_META,
        ...(targetMeta ?? prev),
        tableId,
        orderType: targetMeta?.orderType ?? "Dine In",
      }));

      const existing = tables.find((t) => t.id === tableId);
      setTableStatus(tableId, "Occupied", {
        pax: targetMeta?.pax,
        waiterName: targetMeta?.waiterName,
        customerName: targetMeta?.customerName || "Walk-in",
        occupiedSince: existing?.occupiedSince ?? Date.now(),
      });
    },
    [cart, meta, heldCarts, heldMeta, pendingBills, tables, setTableStatus],
  );

  // Explicit final billing handshake: close any ongoing bill instantly. If the
  // table only has a held cart (still eating), totals are computed on the fly.
  const settleOngoing = useCallback(
    (
      tableId: string,
      payment: { method: PaymentMethod; amountTendered?: number; changeReturned?: number },
      invoiceNumber?: string,
    ): CompletedOrder | undefined => {
      if (settledTables.has(tableId)) return undefined;
      setSettledTables((prev) => new Set([...prev, tableId]));

      const bill = pendingBills[tableId];
      let billMeta: OrderMeta;
      let lines: CartLine[];
      let subtotal: number;
      let discount: number;
      let cgst: number;
      let sgst: number;
      let total: number;

      if (bill) {
        billMeta = bill.meta;
        lines = bill.lines;
        subtotal = bill.subtotal;
        discount = bill.discount;
        cgst = bill.cgst;
        sgst = bill.sgst;
        total = bill.total;
      } else {
        const held = heldCarts[tableId];
        if (!held || held.length === 0) {
          setSettledTables((prev) => { const n = new Set(prev); n.delete(tableId); return n; });
          return undefined;
        }
        billMeta = heldMeta[tableId] ?? { ...DEFAULT_META, tableId };
        lines = held;
        subtotal = held.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0);
        discount = 0;
        const base = Math.max(0, subtotal - discount);
        cgst = Math.round(base * (tax.cgstPct / 100));
        sgst = Math.round(base * (tax.sgstPct / 100));
        total = base + cgst + sgst;
      }

      const txn = logCompletedOrder({
        invoiceNumber,
        meta: billMeta,
        lines,
        subtotal,
        discount,
        cgst,
        sgst,
        total,
        paymentMethod: payment.method,
        amountTendered: payment.amountTendered,
        changeReturned: payment.changeReturned,
      });

      // Permanently lock the session down: drop it from both live pools.
      setPendingBills((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      setHeldCarts((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      setHeldMeta((prev) => {
        const next = { ...prev };
        delete next[tableId];
        return next;
      });
      if (billMeta.orderType === "Dine In") {
        setTableStatus(tableId, "Cleaning");
      }
      setSettledTables((prev) => { const n = new Set(prev); n.delete(tableId); return n; });
      return txn;
    },
    [pendingBills, heldCarts, heldMeta, logCompletedOrder, setTableStatus, tax, settledTables],
  );

  const value = useMemo<FOHContextValue>(
    () => ({
      tables,
      setTableStatus,
      heldCarts,
      heldMeta,
      completedOrders,
      logCompletedOrder,
      settledTables,
      pendingBills,
      generateBill,
      settlePendingBill,
      cancelPendingBill,
      recallToWorkspace,
      settleOngoing,
      cart,
      setCart,
      meta,
      updateMeta,
      selectTable,
      holdCart,
      settleCart,
      commitSentCart,
      reservations,
      seatReservation,
      addReservation,
      updateReservation,
      deleteReservation,
      waitlist,
      addWaitlistEntry,
      removeWaitlistEntry,
      promoteWaitlistEntry,
      tips,
      addTip,
      deleteTip,
      qrs,
      regenerateQR,
      updateAllQRMenuVersion,
    }),
    [
      tables,
      setTableStatus,
      heldCarts,
      heldMeta,
      completedOrders,
      logCompletedOrder,
      settledTables,
      pendingBills,
      generateBill,
      settlePendingBill,
      cancelPendingBill,
      cart,
      meta,
      updateMeta,
      selectTable,
      holdCart,
      settleCart,
      commitSentCart,
      reservations,
      seatReservation,
      addReservation,
      updateReservation,
      deleteReservation,
      waitlist,
      addWaitlistEntry,
      removeWaitlistEntry,
      promoteWaitlistEntry,
      tips,
      addTip,
      deleteTip,
      qrs,
      regenerateQR,
      updateAllQRMenuVersion,
    ],
  );

  return <FOHContext.Provider value={value}>{children}</FOHContext.Provider>;
}

export function useFOH(): FOHContextValue {
  const ctx = useContext(FOHContext);
  if (!ctx) throw new Error("useFOH must be used within an FOHProvider");
  return ctx;
}
