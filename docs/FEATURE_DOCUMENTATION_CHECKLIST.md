# Feature Documentation & PR Checklist

This checklist is mandatory for all Pull Requests, feature additions, and AI coding agent tasks. Contributors and agents must fill out this template before completing work.

---

## Task Information
- **Feature Name**:
- **Roadmap Era**: (Era 1: Foundation | Era 2: Organizer OS | Era 3: Participant Network | Era 4: Marketplace | Era 5: Infrastructure | Era 6: Money | Era 7: Global Competition Network)
- **Primary Contributor / Agent**:
- **Date**:

---

## 8-Point Verification Checklist

### 1. What changed in the codebase?
*Briefly list the modified, added, or deleted files, services, components, routes, or database objects.*

- [ ] Files and services listed accurately above.

### 2. Does the Technical Bible need updating?
- [ ] Yes — Section(s) updated: (e.g. Architecture, Domain Model, Engine Internals, API Reference)
- [ ] No — Explain why: (e.g. Pure test refactoring with zero public surface change)

### 3. Does the User Guide & Product Bible need updating?
- [ ] Yes — Section(s) updated: (e.g. Organizer Guide, Participant Guide, Troubleshooting, Demo Playbook)
- [ ] No — Explain why: (e.g. Internal database indexing optimization with zero UI change)

### 4. Did the database, API, routes, or permissions change?
- [ ] Yes — Migrations added / RLS updated / API endpoints added or modified.
- [ ] No — No schema or network interface changes.

### 5. Were migrations or environment variables added?
- [ ] Migration file verified: `supabase/migrations/YYYYMMDD000X_*.sql`
- [ ] Dual-mode fallback verified: `localStorage` / `inMemoryStore` mirrors the schema change.
- [ ] Environment variables updated in `.env.example` with sanitized placeholders.

### 6. Were tests added or updated?
- [ ] Automated Vitest suite updated in `tests/`.
- [ ] All existing 26 test suites pass (`npm run test`).

### 7. Does the Feature Registry & Roadmap status need updating?
- [ ] [docs/feature-registry.json](file:///c:/Users/DELL/Documents/leaderboard/docs/feature-registry.json) updated with file paths, tests, and explicit status (`Implemented`, `Partially implemented`, `Planned`, `Experimental`, `Requires configuration`, `Unverified`).
- [ ] Roadmap sections in Technical Bible and User Guide reflect current status.

### 8. What remains incomplete, unverified, or known as technical debt?
*Record any edge cases, unimplemented provider options, or pending performance audits.*

---

## Sign-off & Automated Checks
- [ ] `npm run docs:validate` passes with 0 errors.
- [ ] `npm run test` passes (all test suites green).
- [ ] `npm run build` succeeds without type errors.
