import { useCallback, useState } from "react";
import { useFOH } from "@/context/FOHContext";
import { useAccounts } from "@/context/AccountsContext";
import { useKDS } from "@/context/KDSContext";
import { useCRM } from "@/context/CRMContext";
import { useSettings } from "@/context/SettingsContext";
import { useRole } from "@/context/RoleContext";
import { useAudit } from "@/context/AuditContext";
import type { PaymentMethod } from "@/context/FOHContext";
import { commitSettlement } from "@/lib/transactionsApi";

const POINTS_PER_RUPEE = 0.1;

export interface SettlementPayload {
  tableId: string;
  payment: {
    method: PaymentMethod;
    amountTendered?: number;
    changeReturned?: number;
  };
  feedback: { rating: number; comment: string };
}

export interface SettlementResult {
  ok: boolean;
  error?: string;
  invoiceNumber?: string;
}

export function useSettlement() {
  const { settleOngoing } = useFOH();
  const { postIncome } = useAccounts();
  const { closeTable } = useKDS();
  const { recordVisit, addFeedback } = useCRM();
  const { nextInvoiceNumber } = useSettings();
  const { role } = useRole();
  const { logAction } = useAudit();
  const [settling, setSettling] = useState<Set<string>>(new Set());

  const finalizeSettlement = useCallback(
    async (payload: SettlementPayload): Promise<SettlementResult> => {
      const { tableId, payment, feedback } = payload;

      if (settling.has(tableId)) {
        return { ok: false, error: "Settlement already in progress for this table." };
      }

      setSettling((prev) => new Set([...prev, tableId]));

      try {
        const invoiceNo = nextInvoiceNumber();
        const txn = settleOngoing(tableId, payment, invoiceNo);

        if (!txn) {
          return { ok: false, error: "No active bill found for this table." };
        }

        const committed = await commitSettlement(txn, role);
        closeTable(tableId);

        postIncome({
          at: Date.now(),
          table: tableId,
          amount: txn.total,
          mode: payment.method,
          server: txn.meta.waiterName,
          id: committed.ledgerId,
        });

        logAction({
          id: committed.auditId,
          role,
          actor: txn.meta.waiterName || role,
          action: "settle_payment",
          detail: `${invoiceNo} · Table ${tableId} · ₹${txn.total.toLocaleString("en-IN")} · ${payment.method}`,
          module: "foh",
        });

        if (txn.meta.customerPhone) {
          recordVisit(
            txn.meta.customerPhone,
            txn.total,
            Math.round(txn.total * POINTS_PER_RUPEE),
          );
          if (feedback.rating > 0) {
            addFeedback(txn.meta.customerPhone, {
              rating: feedback.rating,
              visitDate: new Date().toISOString().slice(0, 10),
              comment: feedback.comment,
            });
          }
        }

        return { ok: true, invoiceNumber: committed.invoiceNumber || invoiceNo };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Settlement failed." };
      } finally {
        setSettling((prev) => {
          const next = new Set(prev);
          next.delete(tableId);
          return next;
        });
      }
    },
    [
      settling,
      nextInvoiceNumber,
      settleOngoing,
      closeTable,
      postIncome,
      recordVisit,
      addFeedback,
      logAction,
      role,
    ],
  );

  const isSettling = useCallback(
    (tableId: string) => settling.has(tableId),
    [settling],
  );

  return { finalizeSettlement, isSettling };
}
