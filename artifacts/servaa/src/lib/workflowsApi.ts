const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const headers = { "content-type": "application/json", "x-outlet-slug": import.meta.env.VITE_OUTLET_SLUG ?? "servaa-main" };
async function post(path: string, body: unknown, resources: string[]): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", credentials: "include", headers, body: JSON.stringify(body) });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error?.message ?? "Workflow failed");
  for (const resource of resources) window.dispatchEvent(new CustomEvent("servaa:resource-changed", { detail: { resource } }));
}
export const commitGrn = (batch: unknown) => post("/inventory/grn", batch, ["inventory_items", "inventory_grn", "accounts_expenses"]);
export const commitPrep = (batch: unknown) => post("/inventory/prep", batch, ["inventory_items", "inventory_prep_logs"]);
export const commitWastage = (entry: unknown) => post("/inventory/wastage", entry, ["inventory_items", "boh_wastage", "accounts_expenses", "audit_log"]);
export const commitRefund = (orderId: string, reason: string) => post(`/orders/${encodeURIComponent(orderId)}/refund`, { reason }, ["foh_completed_orders", "order_refunds", "accounts_expenses", "audit_log"]);
export const commitClockEvent = (event: unknown) => post("/clock", event, ["clock_events"]);
export const commitCustomerFeedback = (phone: string, feedback: unknown) => post(`/customers/${encodeURIComponent(phone)}/feedback`, feedback, ["crm_customers"]);
export const commitPoReceipt = (poId: string, deliveredQtys: Record<string, number>) => post(`/purchase-orders/${encodeURIComponent(poId)}/receive`, { receiptId: `${poId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, deliveredQtys }, ["boh_purchase_orders", "inventory_items", "inventory_grn", "accounts_expenses"]);
