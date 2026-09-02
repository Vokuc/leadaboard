# AGENTS.md

This repository is the LeaderboardOS project: a Next.js leaderboard platform for gaming, sports, fitness, and workplace competitions.

## Required context

- Framework: Next.js 16 with App Router and React 19
- Language: TypeScript
- Styling: Tailwind CSS v4
- Data layer: Supabase with local demo fallback
- Test runner: Vitest
- Linting: ESLint

## High-priority rules

### 1) Respect the Next.js version differences

This project is NOT the generic Next.js you may remember from older tutorials. The app uses the 16.x App Router conventions and may differ from older examples.

Before making changes to routing, server/client boundaries, metadata, or app behavior, read the relevant guidance in the local Next.js docs under `node_modules/next/dist/docs/` and follow the deprecation notes.

### 2) Prefer project patterns over ad hoc fixes

Use the existing architecture instead of introducing one-off patterns:

- Keep feature logic in the relevant domain folders, especially under `src/lib/` and `src/app/`
- Prefer the shared `DatabaseService` access layer in `src/lib/db.ts` over direct Supabase calls from UI code
- Reuse type definitions from `src/types/index.ts`
- Maintain the public leaderboard and dashboard patterns already used in the app

### 3) Keep the app working in both live and demo modes

The project supports:

- Supabase-backed mode when environment variables are configured
- Demo/localStorage mode when they are not

When changing data flow, ensure the logic still works in both modes. A fix that only works in the live database path is not complete.

### 4) Preserve audit and ranking behavior

This product is competition-focused. Score submissions, ranking calculations, activity logs, and season metadata must remain consistent.

If you edit scoring or leaderboard logic, confirm it still behaves correctly for:

- score event updates
- member ranking order
- activity log history
- seasonal boundaries
- public viewing updates

## Project map

- `src/app/` - routes and UI pages
- `src/components/` - reusable UI
- `src/context/` - auth/context providers
- `src/lib/` - services, data access, competition logic
- `src/types/` - shared TypeScript models
- `supabase/migrations/` - database schema and migrations
- `tests/` - project tests

## Commands

- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Build app: `npm run build`
- Run lint: `npm run lint`
- Run tests: `npm run test`

## Editing guidance

- Keep changes minimal and targeted to the root cause
- Use existing naming conventions and domain language from the codebase
- Preserve user-facing behavior unless the task explicitly changes it
- Add or update tests when modifying existing business logic or data behavior
- Document notable non-obvious behavior in code comments only when it adds clarity

## Repo-specific notes

- Competition creation flows live in `src/app/dashboard/create/page.tsx`
- Leaderboard ranking and score event logic is centered in `src/lib/db.ts` and related service modules
- The public leaderboard pages subscribe to real-time score events with Supabase Realtime when configured
- There is a mock/demo mode that stores data in browser localStorage for local development and debugging

## Final instruction

Treat agent work as repository-aware engineering: match the app’s existing patterns, verify the behavior with the smallest relevant checks, and keep the platform stable across both Supabase and demo modes.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
