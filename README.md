# Mukalma

Multi-tenant AI customer-support platform. See [PLAN.md](../PLAN.md) for the full spec.

## Project structure

```
my-better-t-app/
├── apps/
│   ├── admin/                 # agent dashboard (Clerk auth)
│   └── web/                   # customer chat widget
├── packages/
│   ├── backend/               # @mukalma/backend — Convex functions
│   │   └── convex/
│   ├── ui/                    # @mukalma/ui
│   ├── shared/                # @mukalma/shared
│   ├── widget-loader/         # @mukalma/widget-loader
│   └── typescript-config/
└── infra/waha/
```

## Getting started

```bash
pnpm install
pnpm run dev:setup    # first-time Convex setup (runs in packages/backend)
pnpm run dev          # admin :5173 + web :5174 + convex
```

## Environment variables

**apps/web/.env**
```
VITE_CONVEX_URL=
```

**apps/admin/.env**
```
VITE_CONVEX_URL=
VITE_CLERK_PUBLISHABLE_KEY=
```

**packages/backend/.env.local** — auto-managed by Convex CLI (deployment URL, Clerk JWT issuer, etc.)

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm run dev` | Start all apps |
| `pnpm run dev:admin` | Admin app (port 5173) |
| `pnpm run dev:web` | Customer web app (port 5174) |
| `pnpm run dev:convex` | Convex dev server |
| `pnpm run dev:setup` | First-time Convex setup |
