# LeaderboardOS Competition API & Webhooks Reference

This document provides a comprehensive specification and developer integration guide for the LeaderboardOS versioned secure API (`/api/v1`) and signed event webhook system.

---

## 1. Architecture & Security Model

The LeaderboardOS API provides approved external systems and partner integrations with programmatic access to public competition data, live standings, tournament brackets, fixtures, and participant profiles, while securely gating write mutations with granular scope permissions and server-side authorization.

### 1.1 Key Principles

- **Explicit Versioning**: All integration surfaces live under the `/api/v1/` route prefix. Breaking changes will increment the major version prefix (e.g. `/api/v2/`).
- **No Client Trust**: Client-supplied user identifiers or roles are never trusted. Caller identity is strictly derived from the authenticated API key or verified Supabase session.
- **Hashed Secrets**: API key secrets are never stored in plaintext. They are hashed using SHA-256 upon generation. Plaintext secrets are shown only once in the dashboard upon creation or rotation.
- **Constant-Time Verification**: Secret checks and webhook signatures utilize `crypto.timingSafeEqual` to eliminate timing-attack vulnerabilities.
- **Dual Runtime Support**: Operates seamlessly in both Supabase-backed live environments (with PostgreSQL RLS) and local demo/mock storage mode.
- **Private Data Protection**: Private competitions, hidden member passports, and unlisted standings return HTTP 404 or 403 unless the request presents an API key owned by the competition creator or an authorized administrator.

---

## 2. Authentication & Scopes

### 2.1 API Key Structure

LeaderboardOS API keys follow a structured format:
```text
lb_live_<key_id>_<secret>
```
Example: `lb_live_c4d2e1a8_9f3b7d1e8c4a0f2b6e1d5a9c`

### 2.2 Providing Credentials

Credentials can be supplied in either of two HTTP request headers:

1. **Standard Bearer Token (Recommended)**:
   ```http
   Authorization: Bearer lb_live_c4d2e1a8_9f3b7d1e8c4a0f2b6e1d5a9c
   ```
2. **Custom API Key Header**:
   ```http
   X-API-Key: lb_live_c4d2e1a8_9f3b7d1e8c4a0f2b6e1d5a9c
   ```

### 2.3 Scope Hierarchy

API keys can be restricted to minimal privileges needed for the external integration:

| Scope | Description | Permitted Actions |
| :--- | :--- | :--- |
| `read:public` | Public data read access | Read public competitions, published standings, fixtures, results, and public participant passports. |
| `read:competitions` | Organizer read access | Read public competitions as well as private competitions owned by the key holder. |
| `write:scores` | Match score mutation | Submit score events, fixture outcomes, and tournament match results for owned or administered competitions. |
| `write:participants`| Member management | Register new participants or teams into competitions owned or administered by the key holder. |
| `admin` | Full programmatic control | Full read and write capabilities across all resources owned by the account, including webhook subscriptions. |

### 2.4 Secret Rotation & Revocation

- **Rotation**: Callers or organizers can rotate an API key secret at any time. Rotating a key creates a new secret hash and returns the new raw token once, immediately invalidating the previous secret while preserving the key ID, custom rate limits, scopes, and audit trail.
- **Revocation**: Revoking a key sets its status to `revoked`, immediately blocking all subsequent requests with HTTP 401.

---

## 3. Request & Response Standards

### 3.1 Standard Success Envelope

All API endpoints return JSON responses adhering to the `ApiResponse<T>` contract:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 45,
    "hasMore": true
  },
  "error": null
}
```

- `data`: Contains the primary payload (object or array).
- `meta`: Present on paginated or collection endpoints. Contains `page`, `pageSize`, `total`, and `hasMore`.
- `error`: Always `null` on successful requests.

### 3.2 Standard Error Envelope

When an error occurs, the API returns a structured `ApiErrorResponse`:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Participant \"name\" is required.",
    "details": {
      "field": "name"
    }
  }
}
```

### 3.3 Error Codes

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request payload failed schema or business rule validation. |
| `401` | `UNAUTHORIZED` | Missing, invalid, expired, or revoked API key credentials. |
| `403` | `FORBIDDEN` | The API key lacks the required scope or ownership permission for this competition. |
| `404` | `NOT_FOUND` | The requested competition, participant, or resource does not exist or is private. |
| `409` | `DUPLICATE_PARTICIPANT` | Participant or team name is already registered in the competition. |
| `409` | `IDEMPOTENCY_CONFLICT` | An `Idempotency-Key` was reused with a different request payload body. |
| `429` | `RATE_LIMITED` | The API key exceeded its sliding-window request limit. |
| `500` | `INTERNAL_ERROR` | An unexpected server error occurred during processing. |

---

## 4. Rate Limiting & Governance

### 4.1 Sliding-Window Rate Limiter

Every API key has an assigned `rate_limit_per_minute` (default: **60 requests/minute**). Requests are measured using an in-memory sliding window counter on the server.

### 4.2 Rate Limit Response Headers

All API responses (success and error) include standard rate limit headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1729562880
```

When the limit is exceeded, the server returns HTTP `429 Too Many Requests` with a `Retry-After: <seconds>` header.

---

## 5. Idempotent Mutations

Write operations (`POST /api/v1/competitions/:id/scores` and `POST /api/v1/competitions/:id/register`) support idempotency to prevent duplicate score events or registrations caused by network retries.

### 5.1 How It Works

1. The client sends a unique UUID v4 in the `Idempotency-Key` header:
   ```http
   Idempotency-Key: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d
   ```
2. The server computes a SHA-256 digest of the request payload.
3. If the key has never been seen:
   - The operation executes normally.
   - The response status code and JSON body are saved in `api_idempotency_records` with a 24-hour TTL.
4. If the key has already been processed with the **same** payload:
   - The cached response is returned immediately.
   - The header `Idempotent-Replay: true` is included.
5. If the key is reused with a **different** payload:
   - The request is rejected with HTTP `409 Conflict` (`IDEMPOTENCY_CONFLICT`).

---

## 6. Endpoints Reference

### 6.1 Competitions

#### `GET /api/v1/competitions`
Lists public competitions with optional search and engine filters. If authenticated with an API key, competitions owned by the caller (including private ones) are included.

- **Query Parameters**:
  - `page` (number, default: `1`)
  - `pageSize` (number, default: `20`, max: `100`)
  - `search` (string, optional): Matches competition name or slug.
  - `engine` (string, optional): Filter by `simple_points`, `tournament`, or `league_table`.
- **Headers**:
  - `Cache-Control: public, s-maxage=60` (for public unauthenticated requests)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "c1f76012-3f14-419b-a010-000000000001",
      "slug": "premier-championship-2026",
      "name": "Premier Championship 2026",
      "description": "Annual corporate sports competition",
      "visibility": "public",
      "engine_type": "league_table",
      "entity_type": "team",
      "status": "active",
      "cover_image_url": "https://images.unsplash.com/...",
      "participant_count": 16,
      "created_at": "2026-10-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "hasMore": false
  },
  "error": null
}
```

---

#### `GET /api/v1/competitions/:idOrSlug`
Retrieves comprehensive details for a single competition by its UUID or URL slug.

- **Path Parameters**:
  - `idOrSlug` (string): Competition UUID or unique slug.
- **Authorization**:
  - If the competition is `private`, the caller must supply an API key owned by the competition creator or with the `admin` scope.
- **Response**:
```json
{
  "success": true,
  "data": {
    "id": "c1f76012-3f14-419b-a010-000000000001",
    "slug": "premier-championship-2026",
    "name": "Premier Championship 2026",
    "description": "Annual corporate sports competition",
    "visibility": "public",
    "competition_type": "sports",
    "engine_type": "league_table",
    "entity_type": "team",
    "operational_status": "in_progress",
    "participant_count": 16,
    "current_season": {
      "id": "s-2026-q4",
      "name": "Season 4",
      "start_date": "2026-10-01T00:00:00.000Z",
      "end_date": "2026-12-31T23:59:59.000Z"
    },
    "scoring_rules": [
      {
        "id": "r-win",
        "event_name": "Match Win",
        "points": 3
      }
    ],
    "created_at": "2026-10-01T10:00:00.000Z"
  },
  "error": null
}
```

---

#### `GET /api/v1/competitions/:idOrSlug/standings`
Fetches the current leaderboard standings and ranking table. Supports all three core engines:
- **League Table**: Returns rank, points, played, won, drawn, lost, goals for/against, goal difference, form guide.
- **Tournament**: Returns active bracket rounds, match states, and champions.
- **Simple Points**: Returns ranked participant score cards with tie-break explanations.

- **Headers**:
  - `Cache-Control: public, s-maxage=30`
- **Response (League Table example)**:
```json
{
  "success": true,
  "data": {
    "engine_type": "league_table",
    "competition_id": "c1f76012-3f14-419b-a010-000000000001",
    "standings": [
      {
        "rank": 1,
        "participant_id": "m-apex",
        "name": "Apex Predators",
        "team": "Apex",
        "points": 18,
        "played": 6,
        "won": 6,
        "drawn": 0,
        "lost": 0,
        "goals_for": 21,
        "goals_against": 4,
        "goal_difference": 17,
        "form": ["W", "W", "W", "W", "W"]
      }
    ]
  },
  "error": null
}
```

---

#### `GET /api/v1/competitions/:idOrSlug/fixtures`
Returns scheduled match fixtures and tournament pairings.

- **Response**:
```json
{
  "success": true,
  "data": {
    "engine_type": "league_table",
    "competition_id": "c1f76012-3f14-419b-a010-000000000001",
    "fixtures": [
      {
        "id": "fix-101",
        "round_name": "Round 7",
        "status": "scheduled",
        "scheduled_at": "2026-10-25T18:00:00.000Z",
        "home": {
          "id": "m-apex",
          "name": "Apex Predators",
          "score": null
        },
        "away": {
          "id": "m-vort",
          "name": "Vortex FC",
          "score": null
        }
      }
    ]
  },
  "error": null
}
```

---

#### `GET /api/v1/competitions/:idOrSlug/results`
Returns verified match results and historical score events.

- **Query Parameters**:
  - `page` (default: `1`)
  - `pageSize` (default: `20`)
- **Response**:
```json
{
  "success": true,
  "data": [
    {
      "fixture_id": "fix-100",
      "round_name": "Round 6",
      "home_name": "Apex Predators",
      "away_name": "Titan Squad",
      "home_score": 3,
      "away_score": 1,
      "scheduled_at": "2026-10-18T18:00:00.000Z",
      "updated_at": "2026-10-18T19:50:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 48,
    "hasMore": true
  },
  "error": null
}
```

---

### 6.2 Mutation Endpoints

#### `POST /api/v1/competitions/:idOrSlug/scores`
Submits an authoritative score adjustment, league fixture result, or tournament match outcome.

- **Authorization**: Requires `write:scores` or `admin` scope. The key owner must be the competition owner or an assigned competition administrator.
- **Headers**:
  - `Authorization: Bearer <key>`
  - `Content-Type: application/json`
  - `Idempotency-Key: <uuid>` (recommended)

##### Request Payloads by Engine:

**1. League Table Result**:
```json
{
  "fixture_id": "fix-101",
  "home_score": 2,
  "away_score": 1
}
```

**2. Tournament Match Result**:
```json
{
  "match_id": "match-semis-1",
  "home_score": 4,
  "away_score": 2
}
```

**3. Simple Points Event**:
```json
{
  "member_id": "m-participant-123",
  "points": 50,
  "reason": "Top Sales Closer of the Week",
  "rule_id": "rule-weekly-bonus"
}
```

##### Response:
```json
{
  "success": true,
  "data": {
    "message": "Score submitted successfully.",
    "result": {
      "competition_id": "c1f76012-3f14-419b-a010-000000000001",
      "fixture_id": "fix-101",
      "home_score": 2,
      "away_score": 1,
      "status": "completed"
    }
  },
  "error": null
}
```

---

#### `POST /api/v1/competitions/:idOrSlug/register`
Registers a participant or team into a competition.

- **Authorization**: Requires `write:participants` or `admin` scope.
- **Headers**:
  - `Authorization: Bearer <key>`
  - `Idempotency-Key: <uuid>` (recommended)
- **Request Body**:
```json
{
  "name": "Sarah Connor",
  "team": "Cyberdyne Resistance",
  "email": "sarah@resistance.org",
  "avatar_url": "https://api.dicebear.com/7.x/identicon/svg?seed=sarah"
}
```
- **Response**:
```json
{
  "success": true,
  "data": {
    "message": "Participant registered successfully.",
    "member": {
      "id": "mem-e3b8a1c9",
      "competition_id": "c1f76012-3f14-419b-a010-000000000001",
      "name": "Sarah Connor",
      "team": "Cyberdyne Resistance",
      "avatar_url": "https://api.dicebear.com/7.x/identicon/svg?seed=sarah",
      "created_at": "2026-10-22T03:00:00.000Z"
    }
  },
  "error": null
}
```

---

### 6.3 Participant Profiles

#### `GET /api/v1/participants/:idOrHandle`
Fetches a participant's career statistics, verified win count, and earned badges across competitions.

- **Path Parameters**:
  - `idOrHandle` (string): Participant's user ID or unique `@handle`.
- **Response**:
```json
{
  "success": true,
  "data": {
    "username": "sarah_connor",
    "display_name": "Sarah Connor",
    "avatar_url": "https://...",
    "bio": "Competitive sports enthusiast",
    "headline": "Regional Champion 2025",
    "location": "Los Angeles, CA",
    "social_links": {
      "twitter": "sarahc",
      "github": "sconnor"
    },
    "overview": {
      "total_competitions": 14,
      "verified_competitions": 12,
      "total_wins": 5,
      "win_percentage": 35.7,
      "first_place_finishes": 4,
      "highest_rank_achieved": 1,
      "total_points_scored": 1420
    },
    "achievements": [
      {
        "id": "ach-01",
        "achievement_id": "first-win",
        "name": "First Blood",
        "description": "Won your first official tournament match",
        "category": "tournament",
        "badge_icon": "🏆",
        "badge_color": "#eab308",
        "rarity": "rare",
        "awarded_at": "2026-09-12T14:30:00.000Z",
        "is_revoked": false
      }
    ],
    "created_at": "2025-01-15T00:00:00.000Z"
  },
  "error": null
}
```

---

## 7. Signed Event Webhooks

LeaderboardOS provides signed real-time HTTP webhooks allowing external systems (Discord bots, internal company Slack channels, CRM systems, custom sports displays) to react to competition events.

### 7.1 Supported Event Types

| Event Name | Trigger |
| :--- | :--- |
| `competition.updated` | Metadata, schedule, or rules for a competition are modified. |
| `result.submitted` | A match score or points event is recorded. |
| `result.approved` | A disputed or pending result is officially confirmed. |
| `participant.registered`| A new participant or team joins a competition. |
| `competition.completed` | Final champion crowned or season concludes. |
| `test.ping` | Diagnostic test ping dispatched from the Developer Console. |

### 7.2 Webhook Payload Structure

Webhook requests are sent as `POST` requests with `Content-Type: application/json`:

```json
{
  "id": "evt_9b1deb4d3b7d4bad",
  "event": "result.submitted",
  "created_at": "2026-10-22T03:00:00.000Z",
  "data": {
    "competition_id": "c1f76012-3f14-419b-a010-000000000001",
    "fixture_id": "fix-101",
    "home_score": 2,
    "away_score": 1,
    "status": "completed"
  }
}
```

### 7.3 Cryptographic Signature Verification

Every webhook request contains the `X-LeaderboardOS-Signature` HTTP header in the format:
```http
X-LeaderboardOS-Signature: t=1729562880,v1=9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
```

Where:
- `t`: Unix timestamp in seconds when the webhook was signed.
- `v1`: Hex-encoded HMAC SHA-256 signature calculated over `${timestamp}.${rawBody}` using your webhook secret.

#### Verification Steps:
1. Parse `t` and `v1` from the header.
2. Check timestamp freshness: Reject if `|currentTime - t| > 300` seconds (5 minutes) to protect against replay attacks.
3. Compute expected signature:
   ```javascript
   expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
   ```
4. Compare `v1` and `expected` using constant-time comparison (`crypto.timingSafeEqual`).

#### Node.js / Express Example:
```javascript
import crypto from 'crypto';

function verifyLeaderboardWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('='))
  );

  const timestamp = parseInt(parts.t, 10);
  const signature = parts.v1;

  if (isNaN(timestamp) || !signature) {
    throw new Error('Malformed signature header');
  }

  // Replay attack check
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new Error('Webhook signature timestamp expired (possible replay)');
  }

  // Compute HMAC SHA-256
  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  const bufActual = Buffer.from(signature, 'hex');
  const bufExpected = Buffer.from(expectedSignature, 'hex');

  if (bufActual.length !== bufExpected.length || !crypto.timingSafeEqual(bufActual, bufExpected)) {
    throw new Error('Invalid webhook signature');
  }

  return true;
}
```

#### Python / Flask Example:
```python
import hmac
import hashlib
import time

def verify_leaderboard_webhook(raw_body_bytes, signature_header, secret_str, tolerance_seconds=300):
    parts = dict(item.split("=") for item in signature_header.split(","))
    timestamp = int(parts.get("t", 0))
    signature = parts.get("v1", "")

    # Replay attack check
    if abs(int(time.time()) - timestamp) > tolerance_seconds:
        raise ValueError("Webhook signature timestamp expired")

    signed_payload = f"{timestamp}.".encode("utf-8") + raw_body_bytes
    expected = hmac.new(secret_str.encode("utf-8"), signed_payload, hashlib.sha256).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid webhook signature")

    return True
```

### 7.4 Delivery Retry Policy

If the destination endpoint responds with a non-2xx status code or times out (10s threshold):
1. **Initial Attempt**: Delivered immediately.
2. **Attempt 2**: Retried after 10 seconds.
3. **Attempt 3**: Retried after 30 seconds.
4. **Attempt 4**: Retried after 60 seconds.

All attempts, response statuses, error logs, and latencies are recorded in `webhook_deliveries` and can be inspected in real time in the Developer Console.

---

## 8. Webhook Management API

### `GET /api/v1/webhooks`
Lists all webhook subscriptions registered for the authenticated account.
- **Authorization**: `admin` scope.

### `POST /api/v1/webhooks`
Registers a new webhook endpoint.
- **Request Body**:
```json
{
  "url": "https://api.example.com/webhooks/leaderboard",
  "events": ["result.submitted", "participant.registered", "competition.updated"]
}
```
- **Response**: Returns the subscription object and the webhook `secret`. The secret is shown only once.

### `DELETE /api/v1/webhooks/:id`
Deletes a webhook subscription.

### `POST /api/v1/webhooks/:id/test`
Dispatches an immediate diagnostic `test.ping` event to the target URL and returns the delivery report.

---

## 9. Developer Console (`/dashboard/developer`)

The Developer Console provides a web UI for account owners and organizers:

1. **API Keys Tab**:
   - Create scoped keys with one-click presets (`Read-only`, `Score submitter`, `Full Admin`).
   - Copy key secret once during creation or rotation.
   - Inspect key status, prefix, and last-used timestamps.
   - Rotate or revoke keys with a single click.
2. **Webhooks Tab**:
   - Register endpoints with multi-select event subscriptions.
   - Trigger immediate test pings.
   - Inspect delivery logs with HTTP statuses, response times, and failure reasons.
3. **Documentation Tab**:
   - Copy-paste `curl` commands, Node.js, and Python code snippets pre-filled with the active host.

---

## 10. Codebase Implementation Map

| Component | File Path |
| :--- | :--- |
| Database Schema & RLS | [supabase/migrations/202610300001_api_keys_and_webhooks.sql](file:///c:/Users/DELL/Documents/leaderboard/supabase/migrations/202610300001_api_keys_and_webhooks.sql) |
| TypeScript Types | [src/types/index.ts](file:///c:/Users/DELL/Documents/leaderboard/src/types/index.ts) |
| Data Layer Services | [src/lib/db.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/db.ts) |
| Crypto & Signatures | [src/lib/api/crypto.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/crypto.ts) |
| Auth Middleware | [src/lib/api/auth.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/auth.ts) |
| Rate Limiter | [src/lib/api/rateLimiter.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/rateLimiter.ts) |
| Idempotency Engine | [src/lib/api/idempotency.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/idempotency.ts) |
| Webhooks Dispatcher | [src/lib/api/webhooks.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/webhooks.ts) |
| Response Envelopes | [src/lib/api/response.ts](file:///c:/Users/DELL/Documents/leaderboard/src/lib/api/response.ts) |
| Competitions Route | [src/app/api/v1/competitions/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/route.ts) |
| Standings Route | [src/app/api/v1/competitions/[idOrSlug]/standings/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/[idOrSlug]/standings/route.ts) |
| Fixtures Route | [src/app/api/v1/competitions/[idOrSlug]/fixtures/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/[idOrSlug]/fixtures/route.ts) |
| Results Route | [src/app/api/v1/competitions/[idOrSlug]/results/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/[idOrSlug]/results/route.ts) |
| Scores Mutation Route | [src/app/api/v1/competitions/[idOrSlug]/scores/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/[idOrSlug]/scores/route.ts) |
| Participant Register Route | [src/app/api/v1/competitions/[idOrSlug]/register/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/competitions/[idOrSlug]/register/route.ts) |
| Participant Profile Route | [src/app/api/v1/participants/[idOrHandle]/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/participants/[idOrHandle]/route.ts) |
| Webhook Routes | [src/app/api/v1/webhooks/route.ts](file:///c:/Users/DELL/Documents/leaderboard/src/app/api/v1/webhooks/route.ts) |
| Developer Console UI | [src/app/dashboard/developer/page.tsx](file:///c:/Users/DELL/Documents/leaderboard/src/app/dashboard/developer/page.tsx) |
| Automated Vitest Suite | [tests/api/v1/secure-api.test.ts](file:///c:/Users/DELL/Documents/leaderboard/tests/api/v1/secure-api.test.ts) |
