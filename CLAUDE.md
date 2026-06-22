# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# First-time Convex setup (run once)
pnpm run dev:setup

# Start everything (admin :5173 + web :5174 + convex dev server)
pnpm run dev

# Individual services
pnpm run dev:admin       # Admin app only (port 5173)
pnpm run dev:web         # Web/widget app only (port 5174)
pnpm run dev:convex      # Convex backend only

# Build
pnpm run build
pnpm run build:widget    # Build widget-loader (loader.js)

# Type checking
pnpm run check-types

# Lint + format (Biome)
pnpm run check           # biome check --write .

# WAHA (WhatsApp self-hosted, needs Docker)
docker compose -f infra/waha/docker-compose.yml up
```

## Architecture

Turborepo monorepo using **pnpm workspaces**. The backend lives in `packages/backend` (not `convex/` at root).

```
apps/admin/          # @mukalma/admin — React Router v7 + Vite, Clerk auth, agent dashboard
apps/web/            # @mukalma/web — React Router v7 + Vite, customer chat widget + embed
packages/backend/    # @mukalma/backend — all Convex functions (queries, mutations, actions, HTTP)
  convex/            # schema.ts + function files + lib/ auth helpers
packages/ui/         # @mukalma/ui — shadcn/ui primitives shared by both apps
packages/shared/     # @mukalma/shared — Zod schemas, slug utils, constants
packages/widget-loader/  # @mukalma/widget-loader — builds loader.js (embed script)
infra/waha/          # Docker compose for self-hosted WAHA (WhatsApp)
```

### API boundary (strict rule)

**React apps may only call Convex `useQuery`/`useMutation` and Clerk headless hooks.** All external HTTP calls (OpenAI, WAHA, Clerk Backend API, OneSignal) must run inside Convex actions — never from the browser.

### Auth layers

- **Admin app (agents/admins):** Clerk Organizations + JWT. Uses `ClerkProvider` + `ConvexProviderWithClerk`. Headless hooks only (`useSignIn`, `useSignUp`, `useAuth`, `useUser`, `useOrganization`). Never use Clerk's pre-built `<SignIn>`, `<SignUp>`, `<UserButton>` components.
- **Customer (widget):** Anonymous signed sessions. `HMAC-SHA256(sessionId + tenantId + expiresAt, secret)` stored in `localStorage` (keys: `mukalma_session_id`, `mukalma_session_token`, `mukalma_expires_at`). TTL: 7 days.
- **Super-admin:** Clerk `publicMetadata.role = "super_admin"` — set manually in Clerk dashboard.

### Convex function wrappers (`packages/backend/convex/lib/`)

Use these instead of raw `query`/`mutation`:

| Wrapper | Use when |
|---------|----------|
| `withIdentity(ctx)` | Needs Clerk identity but user row optional |
| `withUser(ctx)` | Requires authenticated user row |
| `withTenant(ctx)` | Scopes to `ctx.user.tenantId` |
| `withAdmin(ctx)` | Requires `role: org_admin` |
| `withSuperAdmin(ctx)` | Requires `publicMetadata.role === "super_admin"` |

Public customer mutations must validate the `customerSessionToken` HMAC before any DB access.

### Convex backend file layout

Files in `packages/backend/convex/` split by concern. Internal (scheduled/webhook-only) actions use `"use node"` directive and are named with `Internal` suffix or placed in separate files (e.g., `documentsInternal.ts`, `embeddingsSearch.ts`). HTTP routes in `httpActions.ts` + wired in `http.ts`.

### AI / RAG pipeline (two-model)

- **Embedding:** Google `gemini-embedding-001` (3072 dims — its natural default), ~500 token chunks with 50-token overlap
- **Chat model (`CHAT_MODEL`):** `gemini-2.5-flash` — handles greetings, small-talk, and general replies. Returns `[NEEDS_DOCS]` when document retrieval is required, `[ESCALATE]` if it cannot handle at all.
- **RAG model (`RAG_MODEL`):** `gemini-2.5-flash` — triggered only when chat model returns `[NEEDS_DOCS]`. Receives retrieved document chunks and returns a grounded answer or `[ESCALATE]`.
- **Retrieval:** top-5 chunks above 0.7 cosine similarity from Convex vector index on `documentChunks`
- **Debounce:** 2s per thread before triggering `ai.generateReply`
- **System prompts:** `buildChatSystemPrompt` and `buildRagSystemPrompt` in `packages/backend/lib/systemPrompt.ts`

### Escalation logic

Thread status enum (exact, no others): `open` | `escalated` | `closed`. Escalation triggers: LLM returns `[ESCALATE]`, zero chunks above threshold, escalation keyword match, or customer clicks "Talk to a human". On escalate: round-robin assign to next online agent (heartbeat within 60s). Fallback: `assignedToUserId = null` (unassigned queue). Agent presence heartbeat runs every 30s via `presence.heartbeat`.

### Linting

Biome (not ESLint). Config in `biome.json` at root. Uses tabs for indentation, double quotes for JS/TS. `convex/_generated` is excluded. Runs on pre-commit via husky + lint-staged.

## Environment variables

**`packages/backend/.env.local`** (auto-managed by Convex CLI + manual additions):
```
CONVEX_DEPLOYMENT=
CLERK_JWT_ISSUER_DOMAIN=
CLERK_SECRET_KEY=
CLERK_WEBHOOK_SECRET=
CUSTOMER_SESSION_SECRET=   # random 32+ bytes hex
GEMINI_API_KEY=            # Google AI Studio key (text-embedding-004 + gemini-2.5-flash)
WAHA_BASE_URL=http://localhost:3001
WAHA_API_KEY=
```

**`apps/admin/.env`:**
```
VITE_CONVEX_URL=
VITE_CLERK_PUBLISHABLE_KEY=
```

**`apps/web/.env`:**
```
VITE_CONVEX_URL=
VITE_WIDGET_CDN_URL=http://localhost:5174
```

## Key design decisions (from PLAN.md)

- **Multi-tenant:** Every DB row has `tenantId`. All queries filter by tenant. Tenant identified by `slug` (URL-safe, unique, reserved slugs blocked).
- **WhatsApp:** One WAHA session per tenant (`tenant-{slug}` naming). All WAHA calls use `WAHA_BASE_URL` + `WAHA_API_KEY` env vars; session name comes from `tenants.wahaSessionName` — never hardcode.
- **Widget embed:** Two modes — standalone (`{slug}.mukalma.co`) and iframe embed via `loader.js` from CDN. CORS validated against `tenants.settings.allowedDomains`.
- **Agents (staff) never use Signup** — invite-only via `users.inviteAgent` → Clerk org invitation email → AcceptInvite page.
- **`agentUnreadCount`** on threads tracks unread customer messages for inbox badges; reset to 0 via `threads.markRead` when agent opens thread.
