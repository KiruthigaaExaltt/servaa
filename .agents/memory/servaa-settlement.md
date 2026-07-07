---
name: Servaa settlement flow
description: How table settlement is orchestrated across contexts
---

`src/hooks/useSettlement.ts` is the single settlement path. Call `finalizeSettlement({ tableId, payment, feedback })` from any UI component.

Internally it:
1. Calls `nextInvoiceNumber()` from SettingsContext (GST sequential numbering)
2. Calls `settleOngoing(tableId, { invoiceNumber, method, ... })` from FOHContext
3. Calls `closeTable(tableId)` from KDSContext
4. Posts income via `postIncome()` from AccountsContext
5. Calls `recordVisit` + `addFeedback` from CRMContext if phone present
6. Logs to AuditContext

**Why:** Previously settlement logic was scattered in FloorMap; centralized to ensure audit, CRM, and invoice numbering always happen atomically.

**How to apply:** Never call `settleOngoing` or `closeTable` directly from a component. Always go through `useSettlement`.
