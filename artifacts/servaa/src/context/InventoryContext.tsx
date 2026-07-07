import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { SEED_INVENTORY, type InventoryItem } from "@/lib/inventoryData";
import {
  PREP_RECIPES,
  SEED_GRN,
  SEED_PREP_LOGS,
  computePrepDraw,
  type GRNBatch,
  type PrepBatchLog,
} from "@/lib/grn";
import { useCollectionState } from "@/lib/collectionState";
import { commitGrn, commitPrep } from "@/lib/workflowsApi";

const LOW_STOCK_DAYS_AHEAD = 3;

/* ---------- Patch / entry shapes ---------- */

export interface UpdateItemPatch {
  addStock: number;
  newPrice: number;
  supplierName: string;
  supplierContact: string;
}

export interface ReceiveGRNEntry {
  inventoryId: string;
  batchNumber: string;
  qtyReceived: number;
  unitCost: number;
}

export interface LogPrepEntry {
  recipeId: string;
  yieldQty: number;
  preparedBy: string;
}

export interface LogPrepResult {
  ok: boolean;
  error?: string;
  warnings?: string[];
  batchCost?: number;
}

export interface LowStockAlert {
  item: InventoryItem;
  percentLeft: number;
}

export interface ExpiryAlert {
  item: InventoryItem;
  daysUntilExpiry: number;
  isExpired: boolean;
}

/* ---------- Context shape ---------- */

interface InventoryContextValue {
  items: InventoryItem[];
  grnBatches: GRNBatch[];
  prepLogs: PrepBatchLog[];
  updateItem: (id: string, patch: UpdateItemPatch) => void;
  receiveGRN: (entry: ReceiveGRNEntry) => void;
  logPrep: (entry: LogPrepEntry) => LogPrepResult;
  lowStockAlerts: LowStockAlert[];
  expiryAlerts: ExpiryAlert[];
}

const InventoryContext = createContext<InventoryContextValue | undefined>(
  undefined,
);

/* ---------- Provider ---------- */

export function InventoryProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useCollectionState<InventoryItem[]>("inventory_items", SEED_INVENTORY);
  const [grnBatches] = useCollectionState<GRNBatch[]>("inventory_grn", SEED_GRN);
  const [prepLogs] = useCollectionState<PrepBatchLog[]>("inventory_prep_logs", SEED_PREP_LOGS);
  const logPrepLock = useRef(false);

  const updateItem = useCallback((id: string, patch: UpdateItemPatch) => {
    setItems((arr) =>
      arr.map((it) =>
        it.id !== id
          ? it
          : {
              ...it,
              stock: Math.max(0, it.stock + patch.addStock),
              unitPrice: patch.newPrice,
              supplierName: patch.supplierName,
              supplierContact: patch.supplierContact,
              lastRestocked:
                patch.addStock > 0
                  ? new Date().toISOString().slice(0, 10)
                  : it.lastRestocked,
            },
      ),
    );
  }, [setItems]);

  const receiveGRN = useCallback(
    (entry: ReceiveGRNEntry) => {
      const item = items.find((i) => i.id === entry.inventoryId);
      if (!item) return;
      const batchId = `grn-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const batch: GRNBatch = {
        id: batchId,
        inventoryId: item.id,
        itemName: item.name,
        unit: item.unit,
        batchNumber: entry.batchNumber,
        qtyReceived: entry.qtyReceived,
        unitCost: entry.unitCost,
        supplierName: item.supplierName,
        receivedAt: Date.now(),
      };
      void commitGrn({ ...batch, resultingStock: Math.round((item.stock + entry.qtyReceived) * 1000) / 1000 });
    },
    [items],
  );

  const logPrep = useCallback(
    (entry: LogPrepEntry): LogPrepResult => {
      if (logPrepLock.current)
        return { ok: false, error: "Submission already in progress." };
      logPrepLock.current = true;

      try {
        const recipe = PREP_RECIPES.find((r) => r.id === entry.recipeId);
        if (!recipe) return { ok: false, error: "Recipe not found." };

        const { consumed, shortfalls } = computePrepDraw(
          recipe,
          entry.yieldQty,
          items,
        );

        const warnings: string[] = [];

        if (shortfalls.length > 0) {
          warnings.push(
            `Insufficient stock for: ${shortfalls.map((s) => s.name).join(", ")} â€” stock floored at 0.`,
          );
        }


        const batchCost = consumed.reduce((acc, c) => {
          const item = items.find((i) => i.id === c.inventoryId);
          return acc + (item ? item.unitPrice * c.qty : 0);
        }, 0);

        const log: PrepBatchLog = {
          id: `prep-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          recipeId: recipe.id,
          recipeName: recipe.name,
          yieldQty: entry.yieldQty,
          yieldUnit: recipe.yieldUnit,
          preparedBy: entry.preparedBy,
          at: Date.now(),
          consumed,
        };
        void commitPrep({ ...log, yieldUnit: recipe.yieldUnit, consumed: consumed.map((draw) => ({ ...draw, resultingStock: Math.round(Math.max(0, (items.find((item) => item.id === draw.inventoryId)?.stock ?? 0) - draw.qty) * 1000) / 1000 })) });

        return { ok: true, warnings, batchCost };
      } finally {
        setTimeout(() => {
          logPrepLock.current = false;
        }, 200);
      }
    },
    [items],
  );

  const lowStockAlerts = useMemo<LowStockAlert[]>(() => {
    return items
      .filter((it) => {
        const par = (it as InventoryItem & { parLevel?: number }).parLevel;
        if (par === undefined || par <= 0) return false;
        return it.stock < par;
      })
      .map((it) => {
        const par = (it as InventoryItem & { parLevel?: number }).parLevel ?? 0;
        return { item: it, percentLeft: par > 0 ? Math.round((it.stock / par) * 100) : 0 };
      })
      .sort((a, b) => a.percentLeft - b.percentLeft);
  }, [items]);

  const expiryAlerts = useMemo<ExpiryAlert[]>(() => {
    const todayMs = new Date().setHours(0, 0, 0, 0);
    const futureMs = todayMs + LOW_STOCK_DAYS_AHEAD * 86400_000;
    return items
      .filter((it) => {
        const exp = (it as InventoryItem & { expiryDate?: string }).expiryDate;
        if (!exp) return false;
        const exMs = new Date(exp).setHours(0, 0, 0, 0);
        return exMs <= futureMs;
      })
      .map((it) => {
        const exp = (it as InventoryItem & { expiryDate?: string }).expiryDate!;
        const exMs = new Date(exp).setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((exMs - todayMs) / 86400_000);
        return { item: it, daysUntilExpiry, isExpired: daysUntilExpiry < 0 };
      })
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  }, [items]);

  const value = useMemo<InventoryContextValue>(
    () => ({
      items,
      grnBatches,
      prepLogs,
      updateItem,
      receiveGRN,
      logPrep,
      lowStockAlerts,
      expiryAlerts,
    }),
    [items, grnBatches, prepLogs, updateItem, receiveGRN, logPrep, lowStockAlerts, expiryAlerts],
  );

  return (
    <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>
  );
}

export function useInventory(): InventoryContextValue {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error("useInventory must be used within InventoryProvider");
  return ctx;
}
