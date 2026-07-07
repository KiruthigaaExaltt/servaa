---
name: Menu admin combos & dynamic pricing
description: Invariants for combo meals and per-item dynamic pricing in Servaa Menu Management
---

# Combo meals & dynamic pricing invariants

The Menu Management module (à-la-carte + Combo Meals views) and `lib/menuAdmin.ts`
hold a combo engine and a per-item dynamic pricing engine. Keep these invariants when
touching either.

## Combo referential integrity
- Combos reference items by id inside `slots[*].itemIds`. Deleting a menu item MUST
  cascade: strip the id from every combo slot, and auto-disable (`isAvailable=false`)
  any combo left with an empty slot.
- **Why:** orphan ids render as empty/null chips operators can't remove, and a combo
  with an unfillable slot must never stay sellable.
- **How to apply:** any code path that removes/retires items (bulk delete, archive,
  imports) must run the same cascade, not just single-item delete.
- Slot "filled" validation must check the item still EXISTS (`itemsById.has(id)`), not
  just `itemIds.length > 0`, or stale ids pass validation.

## Dynamic pricing stacking
- `computeEffectivePrice(base, pricing, source, now)` stacks TIME rules first, then the
  SOURCE rule, rounding once at the end. Time windows support overnight wrap (e.g.
  22:00–02:00) via `timeInRange`.
- It applies ALL matching source rules, so duplicate rules for the same channel would
  multiply. The editor prevents this by filtering the source `<select>` to channels not
  already used by another rule (one rule per channel).
- **Why:** without the one-rule-per-channel constraint, two "+10% Zomato" rules silently
  compound to +21%.
- **How to apply:** if you ever allow source rules to be created elsewhere, enforce the
  same uniqueness, or change `computeEffectivePrice` to pick a single rule per source.

## Scope
- Dynamic pricing + combos are configured and previewed in Menu Management only; they
  are NOT yet wired into live FOH Ordering price calculation. The live preview matrix
  uses `computeEffectivePrice` against `new Date()`.
