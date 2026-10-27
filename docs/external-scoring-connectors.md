# External Scoring Connectors & Hardware Integration Specification

## 1. Overview & Objective

LeaderboardOS provides an authoritative competition data graph and audit layer. As competitions scale to in-person venues, arenas, and digital tournaments, scoring events may originate from external systems such as:
- Electronic court/field scoreboards
- Handheld official referee apps
- Wearable fitness / timing devices
- Esports tournament server webhooks

This document specifies the integration protocol, verification pipeline, and security requirements for external scoring connectors to submit results without compromising competition integrity.

---

## 2. Ingestion Architecture

```
┌─────────────────────────────────┐
│ External Scoring Source         │
│ (Scoreboard / Referee / Server) │
└───────────────┬─────────────────┘
                │
                │ HTTPS POST with HMAC-SHA256 signature
                ▼
┌────────────────────────────────────────────────────────┐
│ LeaderboardOS Connector Ingestion Pipeline             │
│ 1. Validate signature & timestamp replay window (±5m)  │
│ 2. Check Idempotency Key (deduplicate retries)         │
│ 3. Match against authorized leaderboard / venue        │
└───────────────┬────────────────────────────────────────┘
                │
                ▼
┌────────────────────────────────────────────────────────┐
│ Result Audit & Verification Layer                      │
│ - Certified Referee Device ──► status: 'approved'      │
│ - Uncertified / Open Device ──► status: 'submitted'    │
│ - Records previous payload, proposed payload & actor   │
└────────────────────────────────────────────────────────┘
```

---

## 3. Webhook & API Specification

### Endpoint: `POST /api/v1/connectors/scoring/webhook`

#### Headers
```http
Content-Type: application/json
X-LeaderboardOS-Signature: t=1700000000,v1=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
X-Idempotency-Key: score-match-1042-period-final
```

#### Payload Format (Fixture Result)
```json
{
  "connector_id": "conn-scorekeeper-api",
  "leaderboard_id": "d3b07384-d113-466c-9426-b48ff2f7d3a2",
  "match_type": "fixture_result",
  "match_id": "f81d4fae-7dec-11d0-a765-00a0c91e6bf6",
  "venue_id": "c71d4fae-7dec-11d0-a765-00a0c91e6bf7",
  "home_score": 3,
  "away_score": 1,
  "period": "full_time",
  "statistics": {
    "goals": [
      { "member_id": "m1", "minute": 14 },
      { "member_id": "m1", "minute": 45 },
      { "member_id": "m2", "minute": 78 }
    ],
    "cards": []
  },
  "referee": {
    "name": "Jane Official",
    "badge_number": "REF-8841",
    "is_certified": true
  },
  "evidence_urls": [
    "https://storage.leaderboardos.com/match-sheets/match-1042-signed.pdf"
  ]
}
```

---

## 4. Security & Provenance Controls

1. **HMAC-SHA256 Signatures**: Each external system is provisioned an API secret key. The header `X-LeaderboardOS-Signature` is computed over `t={timestamp}.{raw_body}`. Replays older than 5 minutes are rejected.
2. **Idempotency Guarantee**: All inbound events MUST supply a unique `X-Idempotency-Key`. Duplicate transmissions within a 24-hour window return the cached original response without reprocessing.
3. **Verified vs. Unverified State**:
   - If submitted by an accredited referee device (`is_certified: true` and authorized API key), the fixture result is recorded as `status: 'approved'`.
   - If submitted by an uncertified external feed or test harness, it enters `status: 'submitted'` (unverified) and requires organizer confirmation in the dashboard.
4. **Append-Only Immutability**: Any subsequent score correction creates a new revision in `result_audit_log` with the previous payload, proposed payload, actor identity, and mandatory reason. Historical records are never silently overwritten.
