---
name: Servaa inventory & prep data model
description: How inventory, GRN, prep-recipes, and the two duplicate PO/recipe systems relate in the Servaa prototype
---

# Servaa inventory & prep data model

## Two parallel PO systems — do not merge blindly
There are **two independent Purchase Order definitions**, owned by different modules:
- `lib/procurement.ts` (`VendorProfile`, `PurchaseOrder`, `POStatus`, `SEED_PURCHASE_ORDERS`) — used ONLY by `BOHManagement.tsx`.
- `lib/bohData.ts` also declares its own `PurchaseOrder`/`POStatus`/`SEED_POS`.

The Inventory module (`InventoryManagement.tsx`) was intentionally stripped of all PO/vendor UI. `procurement.ts` is still imported by BOH, so it must NOT be deleted.
**Why:** a request to "remove POs from Inventory" is module-scoped; the same-named types elsewhere are separate and still live.

## Two parallel recipe systems — different purposes
- `lib/bohData.ts` `SEED_RECIPES` maps a **menu item → per-portion** ingredient qtys (used for menu costing in BOH). Ingredient qty is per single served dish.
- `lib/grn.ts` `PREP_RECIPES` maps a **bulk base preparation** (gravies/doughs/marinades) → ingredient qty **per 1 unit of finished yield** (KG/Ltr). A 10 KG batch multiplies each qty by 10. This drives the Inventory "Recipe Prep" deduction engine.

Do not reuse `SEED_RECIPES` for prep deduction — its per-portion scale and menu-item keying are wrong for bulk production.

## Inventory state is component-local, not context
`InventoryManagement` holds `items` in `useState(SEED_INVENTORY)`; BOH imports `SEED_INVENTORY` separately. There is no shared inventory context. GRN top-ups and prep deductions mutate this local state only and reset on tab switch (MainLayout unmounts inactive modules). Seeded GRN/prep history (`SEED_GRN`, `SEED_PREP_LOGS` in `grn.ts`) are demo-only display records — they are NOT applied to `SEED_INVENTORY` stock.

## Ingredient name alignment gotcha
`grn.ts` and `bohData.ts` resolve ingredients by exact case-insensitive name against `SEED_INVENTORY` via an `inv()` helper; unmatched names return null and are silently filtered out. When adding formulas, use the exact inventory names (e.g. "Butter (Salted)", "Chicken (Boneless)", "Refined Sunflower Oil"), or the ingredient is dropped with no error.

## Cross-module accounting hook
GRN intake posts a `Groceries` expense to `AccountsContext.postExpense` (mirrors the old PO-receive behavior). Keep GRN receipts flowing to the ledger so Accounts stays meaningful.
