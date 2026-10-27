# ADR-0003: Multi-Engine Competition Abstraction

## Status
Accepted

## Context
Competitions take fundamentally diverse operational forms:
1. **Simple Points Leaderboards**: Continuous ranking of individual participants based on accumulated points or highest recorded score (e.g., arcade gaming, sales leaderboards, fitness challenges).
2. **League Tables**: Round-robin or structured multi-round schedules with fixtures, win/draw/loss records, goal/point differentials, and tie-breaker hierarchies.
3. **Knockout Tournaments**: Bracket-based elimination (single or double elimination) with seeding, rounds (Quarter-Finals, Semi-Finals, Finals), match outcomes, and automatic bracket advancement.

Building three completely separate software applications or duplicating registration, auth, sharing, and embeds for each format would create maintenance fragmentation and prevent multi-stage competitions (e.g., group stages advancing to knockout playoffs).

## Decision
We introduced a **Polymorphic Multi-Engine Architecture** rooted in a shared `leaderboards` table and common lifecycle system:

1. **Root Entity**: Every competition is registered in the `leaderboards` table with a discriminant column `competition_type`: `'simple_points' | 'league_table' | 'tournament'`.
2. **Specialized Extension Tables**:
   - `simple_points`: Uses `leaderboard_members` and `score_events`.
   - `league_table`: Uses `league_standings`, `fixtures`, and `competition_rules` (for point allocations and tie-breaker chains).
   - `tournament`: Uses `tournament_matches`, `tournament_participants`, and bracket layout metadata.
3. **Engine Abstraction Layer**: Located in [src/lib/competition/engines/](file:///c:/Users/DELL/Documents/leaderboard/src/lib/competition/engines/), providing uniform interfaces for:
   - Lifecycle transitions (`draft` -> `registration` -> `in_progress` -> `completed` -> `archived`).
   - Member/participant registration.
   - Result submission and calculation.
   - Export and public presentation adapters.
4. **Multi-Stage Pathways**: Supported via [PathwayService](file:///c:/Users/DELL/Documents/leaderboard/src/lib/competition/pathway/service.ts) and migration `202610230001_competition_lifecycle_and_multistage.sql`, enabling top performers from a league table or leaderboard to automatically populate tournament bracket seeds.

## Alternatives Considered
- **Separate Microservices for Leagues, Tournaments, and Points**: Excessively complex operational footprint for an integrated SaaS product.
- **Single Denormalized Table for All Match Types**: Resulted in sparse columns and messy validation rules across disparate competition mechanics.

## Consequences
### Positive
- Common infrastructure (auth, billing, branding, API keys, webhooks, passports, analytics) works identically across all three competition types.
- Users can transition or link competitions into multi-stage events seamlessly.
- Public embeds and QR codes use consistent slug patterns (`/leaderboards/[slug]`, `/embed/[slug]`).

### Negative / Trade-offs
- UI routing must branch conditionally based on `competition_type` (e.g., rendering bracket diagrams vs tabular standings vs score activity feeds).
- TypeScript models in [src/types/index.ts](file:///c:/Users/DELL/Documents/leaderboard/src/types/index.ts) must maintain disciminative union types for competition configurations.
