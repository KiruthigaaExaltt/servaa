import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { KOT, KOTItemStatus } from "@/types";
import { useCollectionState } from "@/lib/collectionState";

interface KDSContextValue {
  activeKOTs: KOT[];
  addOrder: (kot: KOT) => void;
  updateItemStatus: (
    kotId: string,
    itemId: string,
    status: KOTItemStatus,
  ) => void;
  voidItem: (kotId: string, itemId: string, reason: string) => void;
  closeTable: (tableId: string) => void;
  kotsByTable: Record<string, KOT[]>;
  getKOTsForTable: (tableId: string) => KOT[];
}

const KDSContext = createContext<KDSContextValue | undefined>(undefined);

export function KDSProvider({ children }: { children: ReactNode }) {
  const [activeKOTs, setActiveKOTs] = useCollectionState<KOT[]>("kds_active_kots", []);

  const addOrder = useCallback((kot: KOT) => {
    setActiveKOTs((prev) => [...prev, kot]);
  }, [setActiveKOTs]);

  const updateItemStatus = useCallback(
    (kotId: string, itemId: string, status: KOTItemStatus) => {
      setActiveKOTs((prev) =>
        prev.map((kot) =>
          kot.id !== kotId
            ? kot
            : {
                ...kot,
                items: kot.items.map((item) =>
                  item.id === itemId ? { ...item, status } : item,
                ),
              },
        ),
      );
    },
    [setActiveKOTs],
  );

  const voidItem = useCallback(
    (kotId: string, itemId: string, reason: string) => {
      if (!reason || !reason.trim()) {
        throw new Error("A void reason is required to cancel an item.");
      }
      setActiveKOTs((prev) =>
        prev.map((kot) =>
          kot.id !== kotId
            ? kot
            : {
                ...kot,
                items: kot.items.map((item) =>
                  item.id === itemId
                    ? { ...item, isVoided: true, voidReason: reason.trim() }
                    : item,
                ),
              },
        ),
      );
    },
    [setActiveKOTs],
  );

  const closeTable = useCallback((tableId: string) => {
    setActiveKOTs((prev) =>
      prev.filter((kot) => kot.tableId !== tableId),
    );
  }, [setActiveKOTs]);

  const kotsByTable = useMemo(() => {
    const map: Record<string, KOT[]> = {};
    for (const kot of activeKOTs) {
      if (!map[kot.tableId]) map[kot.tableId] = [];
      map[kot.tableId].push(kot);
    }
    return map;
  }, [activeKOTs]);

  const getKOTsForTable = useCallback(
    (tableId: string) => kotsByTable[tableId] ?? [],
    [kotsByTable],
  );

  const value = useMemo<KDSContextValue>(
    () => ({
      activeKOTs,
      addOrder,
      updateItemStatus,
      voidItem,
      closeTable,
      kotsByTable,
      getKOTsForTable,
    }),
    [
      activeKOTs,
      addOrder,
      updateItemStatus,
      voidItem,
      closeTable,
      kotsByTable,
      getKOTsForTable,
    ],
  );

  return <KDSContext.Provider value={value}>{children}</KDSContext.Provider>;
}

export function useKDS(): KDSContextValue {
  const ctx = useContext(KDSContext);
  if (!ctx) throw new Error("useKDS must be used within KDSProvider");
  return ctx;
}
