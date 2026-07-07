---
name: Inventory procurement (vendors & POs)
description: How vendor profiles and purchase orders are embedded in the Servaa Inventory module
---

# Inventory procurement: vendors & purchase orders

The Inventory module (`InventoryManagement.tsx`) has three sub-tabs — Stock Items,
Vendor Profiles, Purchase Orders — backed by `lib/procurement.ts`.

## Vendors are derived, not stored
- `deriveVendors(items)` builds the supplier directory live from the inventory
  (`supplierName`/`supplierContact`/`category` on each `InventoryItem`). Primary
  category = the supplier's most-frequent item category; low-stock counts come from
  `statusOf`.
- **Why:** suppliers have no standalone table; deriving keeps the directory in sync
  with item edits automatically.
- **How to apply:** to add per-vendor fields that AREN'T on items (e.g. payables),
  seed a name-keyed map. `VENDOR_PAYABLES` is a static seed snapshot, NOT computed
  from PO state — relabel/compute if true dynamic liabilities are ever needed.

## Auto-generate PO dedupe spans all OPEN states
- `generateDraftPOs(items, existing)` clusters low/out items by supplier into draft
  POs. It skips items already on a PO in `Draft` OR `Sent` status.
- **Why:** excluding only `Draft` lets a re-run create a duplicate order for an item
  whose draft was already sent. Dedupe must cover every still-pending state.
- **How to apply:** if a new "open" PO status is added, include it in the
  `pendingItemIds` filter or duplicates return.
- Reorder qty = `max(1, ceil(minLevel*2 - stock))` (tops up to 2× the minimum).

## Scope
- MongoDB-backed inventory and procurement state. Receiving a PO must update stock and movement history atomically.
  into inventory yet — lifecycle is Draft→Sent→Received/Cancelled for display.

## Supplier/Vendor directory lives in CRM, not Inventory/BOH
- The supplier CONTACT directory is a contact class ("Suppliers/Vendors" vs
  "Guests") inside `CRMLoyalty.tsx` (`DirectoryView` → `SuppliersView`), built from
  `deriveVendors(SEED_INVENTORY)`. This revived `procurement.ts` (previously unused
  by any component). Keep contact/profile data in CRM; keep the vendor *payout
  ledger* (`VendorPayout`, `SEED_VENDORS`) in Accounts. Directory = who they are,
  Accounts = money owed/paid. Do not merge the two.
- **Why static seed, not live:** there is NO shared inventory context (see
  servaa-inventory-model.md) — inventory edits are component-local and ephemeral,
  so there is nothing "live" to subscribe to. `SEED_INVENTORY` is the catalog
  source of truth. Don't claim runtime sync in UI copy.
