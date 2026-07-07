import type { CompletedOrder, PaymentMethod } from "@/context/FOHContext";
const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
export async function commitSettlement(txn: CompletedOrder, role: string): Promise<{ invoiceNumber: string; ledgerId: string; auditId: string }> {
  const response = await fetch(`${API_BASE}/transactions/settle`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json", "x-outlet-slug": import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main" },
    body: JSON.stringify({ idempotencyKey: txn.id, invoiceNumber: txn.invoiceNumber, tableId: txn.meta.tableId, meta: txn.meta, lines: txn.lines, subtotal: txn.subtotal, discount: txn.discount, cgst: txn.cgst, sgst: txn.sgst, total: txn.total, paymentMethod: txn.paymentMethod satisfies PaymentMethod, amountTendered: txn.amountTendered, changeReturned: txn.changeReturned, pointsEarned: Math.round(txn.total * 0.1), role }),
  });
  if (!response.ok) throw new Error("Settlement could not be committed");
  return response.json() as Promise<{ invoiceNumber: string; ledgerId: string; auditId: string }>;
}
