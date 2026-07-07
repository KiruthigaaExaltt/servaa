---
name: Servaa cross-module state sync
description: How accounting/CRM data flows across Servaa modules, and the provider nesting that makes it work.
---

# Servaa cross-module reactive sync

Servaa modules are independent React views that each held their own seeded
`useState`. To make one module's action visible in another (e.g. FOH settlement
showing up in Accounts or CRM), the shared data MUST live in a context provider,
not in per-module local state.

**Rule:** any feature that spans modules (ledger, feedback, etc.) goes through a
context provider; module components consume it instead of re-seeding locally.

**Why:** a module that does `useState(SEED_X)` is a private copy — writes from
other modules never reach it. CRMLoyalty originally seeded customers locally and
its `setCustomers` was never called, so it silently diverged from CRMContext.
Switching it to `useCRM()` customers was safe precisely because the local state
was read-only.

**How to apply:**
- Provider nesting order in `App.tsx`: KDS > Accounts > CRM > FOH > MainLayout.
  A consumer must sit inside every provider it reads.
- When showing a context entity in a long-lived modal/drawer, re-resolve it live
  from the context list by id (`customers.find(c => c.id === prop.id) ?? prop`)
  so in-place mutations render without reopening.

## Universal Category database is the single source of truth
`lib/categories.ts` (`UNIVERSAL_CATEGORIES` + `stationForCategory`) is the ONE
category taxonomy for the whole app. `menu.ts` re-exports it
(`MENU_CATEGORIES = UNIVERSAL_CATEGORIES`, `MenuCategory`/`MenuCategoryId`
aliased to the universal types) rather than defining its own list; MenuManagement
and FOH Ordering both render from `MENU_CATEGORIES`.
**Rule:** never reintroduce a component-local category array — add/edit
categories only in `categories.ts`.
**Category vs KDS station are distinct:** a category declares a `defaultStation`
used only as the default for NEW menu items; existing items keep their own
per-item `station`, and KDS routes by `item.station`, not by category (so
desserts can intentionally split across stations).

## Ledger engine conventions (AccountsContext)
- `postIncome` / `postExpense` mint ids by continuing the seed's max numeric
  suffix (`BIL-`/`EXP-`) via a `useRef` counter — keep new ids collision-free.
- Cash reconciliation filters strictly on `mode === "Cash"`. Non-cash operating
  losses (e.g. kitchen wastage) use `PaymentMode "Adjustment"` so they hit the
  P&L total but are excluded from till/cash math. Don't post wastage as "Cash".
- State transitions that post to the ledger must be idempotent: guard on the
  PREVIOUS status (e.g. only post a PO expense when status goes non-Received →
  Received), or re-confirming an action double-posts.
- **Auto-outflow triggers:** vendor payout "Pay" (`recordPayout` in
  AccountsManagement) posts a Groceries expense (mode UPI); GRN intake and BOH
  wastage also post. Inflow auto-posts on FOH/Orders settlement. The prompt
  intentionally wants BOTH GRN intake AND invoice-Paid to hit the outflow ledger —
  they are disconnected seed systems (no shared PO), so no real same-purchase
  double-count. Do NOT "fix" this into accrual-vs-cash; it is per spec.
- **Idempotency across async state:** the `paid`-clamp in `setVendors` alone does
  NOT stop a rapid double-click from double-posting, because both clicks read the
  same stale `vendors` closure. Track cumulative paid per id in a `useRef` (updates
  synchronously) and post only the computed `delta`. Same pattern applies to any
  click-driven ledger post.
