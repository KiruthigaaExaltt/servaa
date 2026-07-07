---
name: KDS station rails
description: How the Kitchen Display System is split into per-station rails and the EXPO/Master Chef consolidated view
---

# KDS station rails

The KDS (`KDSManagement.tsx`) is split into rails by physical cooking line: a
"Master Chef / All Stations" (EXPO) tab plus one tab per `StationId`.

## Station labels are KDS-only relabels
- The data model `StationId` stays `Hot | Cold | Bar` (set in Menu Management, the
  routing source of truth). The KDS only *relabels* them for operators:
  Hot → "Tandoor Station", Cold → "Cold Station", Bar → "Beverages / Bar".
- **Why:** renaming the underlying ids would ripple through menu.ts, menuAdmin.ts
  (STATION_OPTIONS), seedKOTs, FOH and types. Relabeling in one component keeps the
  overhaul scoped and reversible.
- **How to apply:** add new lines via the `STATIONS` array in KDSManagement; map any
  new physical line to an existing `StationId` rather than inventing new ids unless
  you intend the cross-module refactor.

## Rail scoping rule
- Selecting a station filters each ticket's items to that `stationId` and derives
  status on that filtered scope, so a station ticket is "Ready" independently of other
  stations. Footer actions act only on the filtered items (station-scoped).
- EXPO/Master Chef keeps all items, groups them by station, and shows per-station
  readiness badges (`isStationReady` over live, non-voided items) for plating
  coordination. Recall clears only restore what was cleared (station subset vs full).
