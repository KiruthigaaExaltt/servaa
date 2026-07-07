---
name: Servaa persistence layer
description: How state is persisted across page reloads in the Servaa app
---

Mutable application data is persisted through the API into outlet-scoped MongoDB collections. Browser storage is not an application database.

**Provider order matters:**
`SettingsProvider > RoleProvider > AuditProvider > KDSProvider > AccountsProvider > InventoryProvider > CRMProvider > FOHProvider > ClockProvider > MainLayout`

FOHContext needs SettingsProvider above it because `settleOngoing` reads `tax.cgstPct` / `tax.sgstPct` from `useSettings()`.

**Why:** Without usePersist, all in-flight orders, clock-in records, and audit entries evaporate on refresh — unacceptable for a restaurant POS.

**How to apply:** When adding a new context with user-generated state (not seed data), wrap its `useState` calls with `usePersist("unique-storage-key", defaultValue)`.
