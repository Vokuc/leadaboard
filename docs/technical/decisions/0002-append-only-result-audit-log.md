# ADR-0002: Append-Only Immutable Score Event Log and Historical Result Provenance

## Status
Accepted

## Context
Competition integrity is paramount. In sports leagues, esports tournaments, and workplace incentive programs, disputes frequently arise over whether a score was altered, who submitted a match result, when a correction occurred, and whether retroactive tampering took place. In naive CRUD systems, score rows are directly mutated with `UPDATE` queries, destroying the historical audit trail and making dispute resolution impossible.

## Decision
LeaderboardOS enforces an **Append-Only Result & Score Event Log Architecture**:

1. **Immutable Score Events**: The `score_events` table represents discrete points transactions with a monotonic timestamp, author identifier (`created_by`), score delta, reason/rule tag, and competition foreign key. PostgreSQL triggers and RLS policies prevent direct `UPDATE` or `DELETE` on finalized events.
2. **Result Provenance & Corrections**: For fixtures and matches, result history is recorded in `fixture_result_history` (migration `202610220001_trustworthy_result_history.sql`). When a score or match winner is corrected:
   - The previous result is archived with a `superseded_at` timestamp and revision counter (`revision_number`).
   - The correcting user must supply a mandatory `change_reason` and optional `evidence_url`.
   - Standings and tournament progressions are deterministically recomputed from the active version while preserving full historical lineage.
3. **Audit Drawer UI**: The organizer dashboard provides a dedicated [ResultAuditDrawer](file:///c:/Users/DELL/Documents/leaderboard/src/components/competition/ResultAuditDrawer.tsx) component allowing public or authorized observers to inspect the complete revision log for any fixture.

## Alternatives Considered
- **In-place Row Updates with DB Audit Triggers**: Captures changes in a generic audit table, but leaves application logic unaware of revisions and forces custom SQL inspection during competition disputes.
- **Full Event Sourcing for Entire System**: Would introduce high architectural complexity across simple entities (e.g., organizer profile names, UI themes) where simple CRUD is sufficient.

## Consequences
### Positive
- Transparent dispute resolution for organizers, coaches, and players.
- Historical replay capability: rankings can be audited or recalculated at any point in time.
- Direct alignment with fair play and tournament compliance standards.

### Negative / Trade-offs
- Recalculating standings after a correction requires running re-evaluation passes across dependent fixtures or member scores.
- Storage growth: repeated corrections produce multiple history rows per fixture.
