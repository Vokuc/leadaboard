# ADR-0005: Relational Data Graph and Analytics Layer within PostgreSQL

## Status
Accepted

## Context
As LeaderboardOS grew across multiple seasons, organizations, and sports leagues, organizers and scouts requested cross-competition insights: tracking team win rates across multiple tournaments, observing player transfers, comparing scoring trends across seasons, and exporting performance data.

A common industry temptation is deploying a dedicated graph database (e.g., Neo4j) or a separate analytics data lake (e.g., Snowflake, ClickHouse). However, introducing an external database cluster dramatically increases infrastructure hosting costs, operational complexity, synchronization latency, and deployment failure points for a platform prioritizing streamlined accessibility.

## Decision
We implemented a **Relational Data Graph and Analytics Layer directly within PostgreSQL** (migration `202611040001_competition_data_graph_and_analytics.sql`):

1. **Normalized Relationship Tables**:
   - `team_name_history`: Captures historical team rebrands, former names, and effective date ranges without breaking historical match records.
   - `competition_participations`: Unifies team and participant registrations across all competition types with performance rollups (`matches_played`, `matches_won`, `points_accumulated`, `final_rank`).
2. **Cross-Competition Analytics Service**: Encapsulated in [CompetitionGraphService](file:///c:/Users/DELL/Documents/leaderboard/src/lib/analytics/competition-graph.ts), executing relational graph queries (team historical record, head-to-head aggregations, cross-competition performance metrics).
3. **Verified vs Unverified Separation**: Every metric cleanly distinguishes official verified competition records (verified organizers, official results) from unverified sandbox or private entries.
4. **RFC 4180 Compliant Streaming CSV Export**: Provided at `/api/v1/analytics/export` and visualized in the organizer dashboard at `/dashboard/analytics`.

## Alternatives Considered
- **External Graph Database (Neo4j / Memgraph)**: High recurring cost, operational overhead, and dual-write consistency issues.
- **Separate OLAP Warehouse (ClickHouse / BigQuery)**: Overkill for current volume; adds ETL delay and extra security perimeter.

## Consequences
### Positive
- Zero added hosting infrastructure or external billing dependencies.
- ACID transaction guarantees and unified Row Level Security across all competition relationships.
- Complete parity in demo mode via in-memory relational graph queries in `CompetitionGraphService`.

### Negative / Trade-offs
- Very large datasets (millions of multi-season matches) may eventually require PostgreSQL read replicas or partitioning strategies.
- Complex multi-hop graph queries must be expressed via SQL recursive CTEs or indexed joins rather than Cypher/GraphQL query languages.
