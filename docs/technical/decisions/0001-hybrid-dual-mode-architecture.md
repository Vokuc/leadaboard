# ADR-0001: Hybrid Dual-Mode Persistence Architecture

## Status
Accepted

## Context
LeaderboardOS must be immediately testable and demonstrable by prospective customers, developers, and AI agents without requiring external cloud accounts or credentials upfront. At the same time, enterprise and production workloads require PostgreSQL with Row Level Security (RLS), real-time pub/sub subscriptions, transactions, and robust indexing.

Earlier approaches considered either mocking with static JSON fixtures (which lacks persistence across page reloads and stateful multi-step flows) or requiring local Docker containers with Supabase CLI (which adds substantial setup friction and dependency on Docker daemon availability).

## Decision
We implemented a **Dual-Mode Persistence Architecture** managed centrally through [DatabaseService](file:///c:/Users/DELL/Documents/leaderboard/src/lib/db.ts):

1. **Production Mode (Supabase-backed)**: Activated automatically when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are present in environment variables. Uses `@supabase/ssr` on server components/routes and `@supabase/supabase-js` on browser clients, enforcing PostgreSQL Row Level Security (RLS) policies and Postgres change publications.
2. **Demo Sandbox Mode (Local Fallback)**: Activated automatically when Supabase environment variables are absent.
   - In browser environments, data is stored in `window.localStorage` under partitioned keys (e.g., `leaderboardos_competitions`, `leaderboardos_fixtures`).
   - In server-side rendering (SSR), API routes, and test runner (Vitest) environments, data is held in thread-safe memory maps (`inMemoryStore`).
   - Pre-seeded with rich sample competitions across sports, gaming, and workplace domains.

All domain services (rules, scheduling, lifecycle, passport, sponsorship, AI manager, analytics) interface through `DatabaseService` or check dual-mode storage abstractions rather than querying Supabase client directly in UI components.

## Alternatives Considered
- **Direct Supabase-Only**: Simpler codebase, but impossible for zero-config evaluations, browser tests, or offline developer demonstrations.
- **Embedded SQLite / WASM**: Heavy client bundle, complex serialization, and incompatibility with Next.js Edge / SSR runtime conventions.

## Consequences
### Positive
- Zero friction for new contributors, evaluators, and automated Vitest suites.
- 100% of core competition features (scheduling, scoring, leagues, tournaments, brackets, passport) work out of the box in demo mode.
- Fast, deterministic unit and integration testing without database network calls.

### Negative / Trade-offs
- Every data access path and domain service must maintain dual-mode parity (implementing both the Supabase query branch and the localStorage/inMemoryStore branch).
- Complex SQL features (recursive CTEs, cross-table join aggregations) must be mirrored in TypeScript logic for demo mode.
