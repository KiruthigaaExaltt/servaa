# Servaa

Restaurant management UI shell with the Servaa branding and a 14-module top navigation.

## Run & Operate

- `pnpm --filter @workspace/servaa run dev` — run the Servaa frontend
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas
- `pnpm --filter @workspace/db run seed` — idempotently seed MongoDB

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, Lucide React
- API: Express 5
- DB: MongoDB + Mongoose (Atlas or replica set)
- Validation: Zod (`zod/v4`) and Mongoose schemas
- API codegen: Orval (from OpenAPI spec)

## Where things live

- `artifacts/servaa/src/components/TopNav.tsx` — top navigation bar
- `artifacts/servaa/src/components/MainLayout.tsx` — app shell + view switcher
- `artifacts/servaa/src/lib/modules.ts` — list of 14 modules (source of truth)
- `artifacts/servaa/src/index.css` — theme tokens, including `--primary-orange: #FF7A1A`
- `lib/api-spec/openapi.yaml` — API contract (codegen source)
- `lib/db/src/schema/` — Mongoose schemas and indexes

## Architecture decisions

- Shell-first: `MainLayout` holds a single `active` state and renders a per-module placeholder; modules are wired via `MODULES` in `lib/modules.ts` so adding/removing tabs is one-file.
- Brand orange exposed both as a CSS var (`--primary-orange`) and mapped into the Tailwind `--primary` token so shadcn-style components inherit it.
- TopNav uses Framer Motion `layoutId` for the animated active underline.

## Product

- Fixed top navigation with Servaa branding, 14 module tabs (Dashboard, Tables, FOH, Menu, KOT/KDS, Inventory, BOH, Delivery, Orders & Billing, Crew, Accounts, CRM & Loyalty, Reports & Analytics, Settings), search/notifications/profile icons.
- Switching tabs swaps the main content area to a per-module placeholder view.

## User preferences

_Populate as you build._

## Gotchas

_Populate as you build._

## Pointers

- See the `pnpm-workspace` skill for workspace structure.
- See the `react-vite` skill for frontend conventions.
