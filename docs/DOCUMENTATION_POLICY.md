# LeaderboardOS Documentation Update Policy

## 1. Purpose & Authority

This document defines the mandatory documentation policy for LeaderboardOS. Documentation is not an afterthought, a marketing artifact, or an optional post-launch chore. It is an integral, non-negotiable part of the engineering lifecycle.

Every engineer, AI coding agent, and technical contributor who makes changes to this repository is bound by this policy.

---

## 2. Core Principles

1. **Grounded in Reality**: Never document speculative roadmaps or aspirations as implemented functionality. If a feature is planned or partially implemented, label it explicitly using the standardized Implementation Status Taxonomy.
2. **Synchronous Documentation Updates**: No pull request or task completion is considered done until all corresponding technical and user documentation is updated in the same commit.
3. **Traceability**: All major features, routes, domain services, database tables, and tests must be cataloged in [docs/feature-registry.json](file:///c:/Users/DELL/Documents/leaderboard/docs/feature-registry.json).
4. **Zero Broken Links**: All internal Markdown links and file references must be relative, valid, and point to existing files or anchored headings.
5. **Security & Privacy Safeguards**: Under no circumstances should live secrets, API keys, service role tokens, or private customer data be included in documentation or code snippets. Use sanitized placeholders (e.g. `sk_live_...`, `anon_key_placeholder`).

---

## 3. Implementation Status Taxonomy

To eliminate ambiguity across the documentation system, every feature, module, or capability must be assigned one of the following six explicit statuses:

| Status | Definition | Criteria for Assignment |
| :--- | :--- | :--- |
| **Implemented** | Confirmed working in the current codebase | Feature code exists, domain service is active, UI or API endpoints are wired, and automated tests pass. |
| **Partially implemented** | Some functionality works, but important components remain incomplete | Core logic or UI exists, but advanced sub-features (e.g., specific edge cases, tie-breakers, or exports) are not yet built. |
| **Planned** | Accepted roadmap item with no active implementation | Feature has been scoped for an era, but no executable code, service, or active UI currently exists. |
| **Experimental** | Exists but not considered stable or generally available | Code is present under a flag, beta route, or experimental prototype subject to breaking redesign. |
| **Requires configuration** | Fully implemented in code, but requires external provider credentials or deployment setup | Feature functions when provider keys (e.g., Paystack secret keys, Gemini API keys, SMTP credentials) are set in `.env.local`. |
| **Unverified** | Insufficient test coverage or runtime evidence to confirm behavior | Code exists but automated tests or end-to-end verification cannot guarantee its correctness. |

> [!WARNING]
> Do NOT label a feature "Implemented" merely because a TypeScript interface, empty database column, placeholder route, or orphaned function exists.

---

## 4. Feature Lifecycle Documentation Triggers

When completing any engineering task, evaluate the following trigger matrix to determine which documentation files must be updated:

| Change Category | Triggering Events | Required Documentation Updates |
| :--- | :--- | :--- |
| **Architecture** | New framework library, runtime changes, caching layer, or state provider | Update Section 2 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); add ADR to `docs/technical/decisions/` if architectural precedent is set. |
| **Database Schema** | New migration, table, column, constraint, index, or RLS policy | Update Section 4 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update ER diagrams; document dual-mode fallback. |
| **Competition Engines** | Changes to scoring, standings, tie-breakers, fixtures, brackets, or lifecycle | Update Section 5 & 7 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update Section 3 of [LEADERBOARDOS_USER_GUIDE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/user/LEADERBOARDOS_USER_GUIDE.md); update unit tests. |
| **Routes & UI Workflows** | New page, updated dashboard layout, form inputs, or public views | Update Section 3 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update Sections 2, 3, or 4 of [LEADERBOARDOS_USER_GUIDE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/user/LEADERBOARDOS_USER_GUIDE.md); update [feature-registry.json](file:///c:/Users/DELL/Documents/leaderboard/docs/feature-registry.json). |
| **API & Webhooks** | New REST endpoint, request/response schema change, webhook event type | Update Section 8 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update [docs/api.md](file:///c:/Users/DELL/Documents/leaderboard/docs/api.md); verify auth/rate-limiting. |
| **Security & Auth** | RBAC permission change, RLS adjustment, token or API key handling | Update Section 6 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update safe checklist. |
| **Billing & Payments** | Pricing tier adjustments, new payment provider, checkout or refund flows | Update Section 8 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update Section 6 of [LEADERBOARDOS_USER_GUIDE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/user/LEADERBOARDOS_USER_GUIDE.md); update [docs/payments.md](file:///c:/Users/DELL/Documents/leaderboard/docs/payments.md). |
| **Roadmap & Era Progress** | Completing or advancing an era milestone | Update Section 12 of [LEADERBOARDOS_TECHNICAL_BIBLE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/technical/LEADERBOARDOS_TECHNICAL_BIBLE.md); update Section 9 of [LEADERBOARDOS_USER_GUIDE.md](file:///c:/Users/DELL/Documents/leaderboard/docs/user/LEADERBOARDOS_USER_GUIDE.md); update [feature-registry.json](file:///c:/Users/DELL/Documents/leaderboard/docs/feature-registry.json). |

---

## 5. Verification & Quality Gates

Before merging code or finalizing an AI agent task:
1. Run the automated documentation validation script:
   ```bash
   npm run docs:validate
   ```
2. Verify that all 26 test suites continue to pass:
   ```bash
   npm run test
   ```
3. Complete the [docs/FEATURE_DOCUMENTATION_CHECKLIST.md](file:///c:/Users/DELL/Documents/leaderboard/docs/FEATURE_DOCUMENTATION_CHECKLIST.md).
