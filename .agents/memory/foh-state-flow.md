---
name: FOH state-flow constraints
description: Non-obvious rules for Servaa FloorMap table-status derivation and CRM customer identity.
---

## KDS-inferred occupancy must not override explicit table states

`FloorMap.effectiveTables` derives a table's *displayed* status from live KDS
activity (active KOT items) on top of the stored `FOHContext` status. It must
only promote **Vacant/Reserved → Occupied**. It must NOT override explicit
operational states (`Occupied`, `Waiting for Settlement`, `Cleaning`,
`Maintenance`).

**Why:** settlement sets a table to `Cleaning`, but KOT items are owned by a
separate `KDSContext` and are not cleared on settle. If the derivation
overrode any non-Occupied status, a just-paid table with still-active KOTs
would snap back to `Occupied`, bypassing the tap-to-vacant Cleaning flow.

**How to apply:** when adding new table statuses, the derivation guard is
`if (t.status !== "Vacant" && t.status !== "Reserved") return t;` — extend the
allow-list deliberately, never invert it to a deny-list.

## Two-stage billing: one pending bill per table

`generateBill` writes `pendingBills[tableId]` unconditionally. Callers (Ordering)
must guard against an existing `pendingBills[tableId]` before generating, or a
second "Generate Bill" silently replaces an unsettled bill (lost revenue in the
ledger). Settle from FloorMap clears it.

## Continuous KOT append & recall loop

"Send to KOT" (Ordering) must NOT wipe or lock the table. It stamps the unsent
cart lines (`sentAt`/`kotId`/`kotItemId` on `CartLine`) and keeps them in the
live cart via `FOHContext.commitSentCart`, which persists to `heldCarts`/
`heldMeta` and keeps the table `Occupied`. Ordering splits the cart into
`cookingLines` (has `sentAt`, read-only, live status read from KDS `activeKOTs`
by `kotItemId`) vs `newLines` (editable). Waiters keep appending until a
supervisor hits Generate Bill.

**KDS clear timing:** clear a table's KOTs (`KDSContext.closeTable`) only at
**settlement** (FloorMap `onPaid`), NOT at bill generation.
**Why:** `cancelPendingBill` restores the held cart but cannot restore KDS
tickets; clearing KOTs at Generate-Bill time would orphan the restored sent
lines (their live statuses degrade to a "Pending" fallback). Tickets staying
live through "Waiting for Settlement" is also operationally correct.

**`selectTable` must no-op when re-selecting the current table**
(`if (tableId === meta.tableId) return;`). Otherwise it deletes the table's held
snapshot and, with no held entry, runs the fresh-table branch that clears the
active cart — silently dropping unsent edits when a waiter re-opens the same
table from FloorMap.

## Orders command-center recall & close-bill (span-module)

The Orders module drives live billing through two `FOHContext` helpers, not by
mutating local state:

- `recallToWorkspace(tableId)` pulls an ongoing session (held cart OR pending
  bill) back into the active editing session. It **sets `cart`/`meta` directly**
  rather than calling `selectTable`, precisely to bypass the same-table no-op
  guard above — otherwise recalling the table already open (default `T-1`) would
  no-op and show an empty session. It also saves the outgoing table's live cart,
  removes the recalled table from held/pending pools, and re-marks it `Occupied`.
- `settleOngoing(tableId, payment)` closes any ongoing bill. For a held cart
  (still eating, no pending bill) it computes totals on the fly with **2.5% CGST
  + 2.5% SGST, no discount** — must stay in parity with Ordering's tax math.

**Close-bill handshake order (mirror FloorMap `onPaid`):** `settleOngoing` →
`closeTable` (KDS) → `postIncome` (Accounts) → `recordVisit`/`addFeedback` (CRM).
Use the `CompletedOrder` **returned by `settleOngoing`** for the downstream
Accounts/CRM payloads, not the pre-settlement snapshot, to avoid stale-closure
drift.

**Why the Ongoing list can be empty on load:** it derives only from live
`heldCarts`/`pendingBills`, which start empty; seeded Occupied tables in
`SEED_TABLES` have no cart. This is intentional (honest live reflection) — do NOT
seed fake ongoing bills into the shared context.

## CRM customer identity

- Phone is canonicalized to the **last 10 digits** (India numbering) in
  `CRMContext.normalizePhone`, so `+91 98765 43210` and `9876543210` match.
- `addCustomer` creates with `visits: 0`. Visits/points/spend are only
  incremented by `recordVisit`, which fires **on settlement**. Seating a guest
  adds them to CRM but does not count as a visit until they pay.
