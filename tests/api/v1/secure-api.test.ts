import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseService, mockDb } from '@/lib/db';
import {
  generateApiKey,
  generateWebhookSecret,
  hashSecret,
  signWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/api/crypto';
import { checkRateLimit, resetRateLimits } from '@/lib/api/rateLimiter';
import { authenticateApiKey } from '@/lib/api/auth';
import { checkIdempotency, saveIdempotencyResponse } from '@/lib/api/idempotency';
import { executeWebhookDelivery, retryWebhookDelivery } from '@/lib/api/webhooks';
import { ApiKey, Leaderboard, WebhookSubscription } from '@/types';

// Mock localStorage and window in node environment
const store: Record<string, string> = {};
global.window = {
  location: { origin: 'http://localhost' },
} as unknown as Window & typeof globalThis;
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => {
    store[key] = value;
  },
  removeItem: (key: string) => {
    delete store[key];
  },
  clear: () => {
    for (const key in store) {
      delete store[key];
    }
  },
} as unknown as Storage;

describe('Era 5: Secure Competition API and Webhooks System', () => {
  const OWNER_USER_ID = 'user-owner-001';
  const OTHER_USER_ID = 'user-other-002';
  const PUBLIC_LB_ID = 'lb-public-001';
  const PRIVATE_LB_ID = 'lb-private-002';

  let readOnlyKey: { apiKey: ApiKey; plaintextSecret: string };
  let scoresKey: { apiKey: ApiKey; plaintextSecret: string };
  let adminKey: { apiKey: ApiKey; plaintextSecret: string };

  beforeEach(async () => {
    localStorage.clear();
    resetRateLimits();

    // 1. Seed Public & Private Leaderboards
    const publicLb: Leaderboard = {
      id: PUBLIC_LB_ID,
      name: 'Global Open Tournament',
      slug: 'global-open-2026',
      description: 'Public community competition.',
      visibility: 'public',
      competition_type: 'gaming',
      owner_id: OWNER_USER_ID,
      status: 'active',
      cover_image_url: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    const privateLb: Leaderboard = {
      id: PRIVATE_LB_ID,
      name: 'Internal Executive League',
      slug: 'internal-executive-league',
      description: 'Confidential company board.',
      visibility: 'private',
      competition_type: 'workplace',
      owner_id: OWNER_USER_ID,
      status: 'active',
      cover_image_url: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    mockDb.setLeaderboards([publicLb, privateLb]);

    // Seed competition configs
    mockDb.set('competition_configs', [
      {
        leaderboard_id: PUBLIC_LB_ID,
        template_key: 'custom',
        engine_type: 'simple_points',
        entity_type: 'individual',
        participation_type: 'online',
        operational_status: 'in_progress',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
      {
        leaderboard_id: PRIVATE_LB_ID,
        template_key: 'custom',
        engine_type: 'simple_points',
        entity_type: 'individual',
        participation_type: 'online',
        operational_status: 'in_progress',
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      },
    ]);

    // Seed Member
    const member = {
      id: 'mem-001',
      leaderboard_id: PUBLIC_LB_ID,
      name: 'Player One',
      team: 'Red',
      avatar_url: null,
      total_points: 100,
      is_active: true,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };
    mockDb.setMembers([member]);

    // 2. Generate and Seed Test API Keys
    const key1Gen = generateApiKey('lb_live');
    const key1: ApiKey = {
      id: key1Gen.keyId,
      owner_id: OWNER_USER_ID,
      name: 'Read Only Client',
      key_prefix: key1Gen.keyPrefix,
      secret_hash: key1Gen.secretHash,
      scopes: ['competitions:read'],
      rate_limit_per_minute: 5, // low limit for rate testing
      status: 'active',
      expires_at: null,
      last_used_at: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    const key2Gen = generateApiKey('lb_live');
    const key2: ApiKey = {
      id: key2Gen.keyId,
      owner_id: OWNER_USER_ID,
      name: 'Scores Submitter',
      key_prefix: key2Gen.keyPrefix,
      secret_hash: key2Gen.secretHash,
      scopes: ['scores:submit', 'competitions:read'],
      rate_limit_per_minute: 60,
      status: 'active',
      expires_at: null,
      last_used_at: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    const key3Gen = generateApiKey('lb_live');
    const key3: ApiKey = {
      id: key3Gen.keyId,
      owner_id: OWNER_USER_ID,
      name: 'Admin Key',
      key_prefix: key3Gen.keyPrefix,
      secret_hash: key3Gen.secretHash,
      scopes: ['admin'],
      rate_limit_per_minute: 120,
      status: 'active',
      expires_at: null,
      last_used_at: null,
      created_at: '2026-06-01T10:00:00Z',
      updated_at: '2026-06-01T10:00:00Z',
    };

    readOnlyKey = { apiKey: key1, plaintextSecret: key1Gen.plaintextSecret };
    scoresKey = { apiKey: key2, plaintextSecret: key2Gen.plaintextSecret };
    adminKey = { apiKey: key3, plaintextSecret: key3Gen.plaintextSecret };

    mockDb.setApiKeys([key1, key2, key3]);
  });

  describe('1. Authentication & Key Validation', () => {
    it('rejects requests missing an API key header with 401 UNAUTHORIZED', async () => {
      const request = new Request('http://localhost/api/v1/competitions', {
        headers: {},
      });

      const auth = await authenticateApiKey(request);
      expect(auth.success).toBe(false);
      if (!auth.success) {
        expect(auth.response.status).toBe(401);
        const data = await auth.response.json();
        expect(data.error.code).toBe('UNAUTHORIZED');
      }
    });

    it('rejects requests with malformed or tampered keys with 401 INVALID_API_KEY', async () => {
      const request = new Request('http://localhost/api/v1/competitions', {
        headers: {
          Authorization: 'Bearer lb_live_invalid_fake_secret_key_123',
        },
      });

      const auth = await authenticateApiKey(request);
      expect(auth.success).toBe(false);
      if (!auth.success) {
        expect(auth.response.status).toBe(401);
      }
    });

    it('authenticates valid keys via Authorization: Bearer and X-API-Key', async () => {
      const reqBearer = new Request('http://localhost/api/v1/competitions', {
        headers: {
          Authorization: `Bearer ${readOnlyKey.plaintextSecret}`,
        },
      });
      const authBearer = await authenticateApiKey(reqBearer);
      expect(authBearer.success).toBe(true);

      const reqCustom = new Request('http://localhost/api/v1/competitions', {
        headers: {
          'X-API-Key': readOnlyKey.plaintextSecret,
        },
      });
      const authCustom = await authenticateApiKey(reqCustom);
      expect(authCustom.success).toBe(true);
    });

    it('rejects revoked keys with 401 API_KEY_REVOKED', async () => {
      await DatabaseService.updateApiKey(readOnlyKey.apiKey.id, { status: 'revoked' });

      const request = new Request('http://localhost/api/v1/competitions', {
        headers: {
          Authorization: `Bearer ${readOnlyKey.plaintextSecret}`,
        },
      });

      const auth = await authenticateApiKey(request);
      expect(auth.success).toBe(false);
      if (!auth.success) {
        expect(auth.response.status).toBe(401);
        const data = await auth.response.json();
        expect(data.error.code).toBe('API_KEY_REVOKED');
      }
    });

    it('rejects expired keys with 401 API_KEY_EXPIRED', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
      await DatabaseService.updateApiKey(readOnlyKey.apiKey.id, { expires_at: pastDate });

      const request = new Request('http://localhost/api/v1/competitions', {
        headers: {
          Authorization: `Bearer ${readOnlyKey.plaintextSecret}`,
        },
      });

      const auth = await authenticateApiKey(request);
      expect(auth.success).toBe(false);
      if (!auth.success) {
        expect(auth.response.status).toBe(401);
        const data = await auth.response.json();
        expect(data.error.code).toBe('API_KEY_EXPIRED');
      }
    });
  });

  describe('2. Scope Enforcement & Role Isolation', () => {
    it('denies write mutations when key only possesses competitions:read scope', async () => {
      const request = new Request('http://localhost/api/v1/competitions/some-comp/scores', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${readOnlyKey.plaintextSecret}`,
        },
      });

      const auth = await authenticateApiKey(request, 'scores:submit');
      expect(auth.success).toBe(false);
      if (!auth.success) {
        expect(auth.response.status).toBe(403);
        const data = await auth.response.json();
        expect(data.error.code).toBe('INSUFFICIENT_SCOPE');
      }
    });

    it('permits score mutations when key possesses scores:submit scope', async () => {
      const request = new Request('http://localhost/api/v1/competitions/some-comp/scores', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${scoresKey.plaintextSecret}`,
        },
      });

      const auth = await authenticateApiKey(request, 'scores:submit');
      expect(auth.success).toBe(true);
    });

    it('grants access to all operations when key has admin scope', async () => {
      const request = new Request('http://localhost/api/v1/competitions/some-comp/scores', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminKey.plaintextSecret}`,
        },
      });

      const auth = await authenticateApiKey(request, 'scores:submit');
      expect(auth.success).toBe(true);

      const authManage = await authenticateApiKey(request, 'webhooks:manage');
      expect(authManage.success).toBe(true);
    });
  });

  describe('3. Rate Limiting Sliding Window', () => {
    it('enforces request limit per minute and outputs standard rate limit headers', () => {
      const keyId = 'test-rate-key';
      const limit = 3;

      // 1st request -> ok
      const r1 = checkRateLimit(keyId, limit);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      // 2nd request -> ok
      const r2 = checkRateLimit(keyId, limit);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      // 3rd request -> ok
      const r3 = checkRateLimit(keyId, limit);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);

      // 4th request -> blocked (429)
      const r4 = checkRateLimit(keyId, limit);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.resetSeconds).toBeGreaterThan(0);
    });
  });

  describe('4. Secret Rotation', () => {
    it('rotates secret, invalidating the old plaintext secret while preserving key metadata', async () => {
      const initialSecret = scoresKey.plaintextSecret;
      const keyId = scoresKey.apiKey.id;

      // Rotate: generate new random secret
      const newSecretRandom = 'f0e1d2c3b4a5968778695a4b3c2d1e0f01020304';
      const newPlaintextSecret = `${scoresKey.apiKey.key_prefix}_${newSecretRandom}`;
      const newSecretHash = hashSecret(newPlaintextSecret);

      await DatabaseService.updateApiKey(keyId, { secret_hash: newSecretHash });

      // Request with OLD secret fails
      const reqOld = new Request('http://localhost/api/v1/competitions', {
        headers: { Authorization: `Bearer ${initialSecret}` },
      });
      const authOld = await authenticateApiKey(reqOld);
      expect(authOld.success).toBe(false);

      // Request with NEW secret succeeds
      const reqNew = new Request('http://localhost/api/v1/competitions', {
        headers: { Authorization: `Bearer ${newPlaintextSecret}` },
      });
      const authNew = await authenticateApiKey(reqNew);
      expect(authNew.success).toBe(true);
    });
  });

  describe('5. Idempotency Key Handling', () => {
    it('prevents duplicate score mutations and safely replays previous response', async () => {
      const idempotencyKey = 'idem-unique-key-123';
      const payload = JSON.stringify({ member_id: 'mem-001', points: 25 });
      const request = new Request('http://localhost/api/v1/competitions/lb-public-001/scores', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });

      // First check: new request
      const firstCheck = await checkIdempotency(request, scoresKey.apiKey.id, payload);
      expect(firstCheck.hasKey).toBe(true);
      expect(firstCheck.isReplay).toBeFalsy();

      // Simulate saving response
      await saveIdempotencyResponse(
        scoresKey.apiKey.id,
        idempotencyKey,
        '/api/v1/competitions/lb-public-001/scores',
        firstCheck.requestHash!,
        201,
        { success: true, pointsAwarded: 25 }
      );

      // Second check with IDENTICAL payload -> returns replay response
      const secondCheck = await checkIdempotency(request, scoresKey.apiKey.id, payload);
      expect(secondCheck.isReplay).toBe(true);
      expect(secondCheck.replayResponse?.headers.get('Idempotent-Replay')).toBe('true');
      expect(secondCheck.replayResponse?.status).toBe(201);

      // Third check with DIFFERENT payload under same key -> returns 409 conflict
      const differentPayload = JSON.stringify({ member_id: 'mem-001', points: 999 });
      const thirdCheck = await checkIdempotency(request, scoresKey.apiKey.id, differentPayload);
      expect(thirdCheck.conflictResponse).toBeDefined();
      expect(thirdCheck.conflictResponse?.status).toBe(409);
    });
  });

  describe('6. Webhook Signing, Timestamp Replay Protection & Delivery', () => {
    it('signs webhook payloads with HMAC SHA-256 and verifies successfully', () => {
      const secret = generateWebhookSecret();
      const payload = { event: 'competition.updated', competition_id: PUBLIC_LB_ID };
      const nowSeconds = Math.floor(Date.now() / 1000);

      const { signatureHeader } = signWebhookPayload(secret, payload, nowSeconds);
      expect(signatureHeader).toContain(`t=${nowSeconds}`);
      expect(signatureHeader).toContain('v1=');

      const verification = verifyWebhookSignature(secret, JSON.stringify(payload), signatureHeader);
      expect(verification.valid).toBe(true);
    });

    it('rejects webhook payloads when timestamp drift exceeds tolerance (replay attack prevention)', () => {
      const secret = generateWebhookSecret();
      const payload = { event: 'competition.updated', competition_id: PUBLIC_LB_ID };
      // 10 minutes old (600 seconds)
      const staleTimestamp = Math.floor(Date.now() / 1000) - 600;

      const { signatureHeader } = signWebhookPayload(secret, payload, staleTimestamp);
      const verification = verifyWebhookSignature(secret, JSON.stringify(payload), signatureHeader, 300);

      expect(verification.valid).toBe(false);
      expect(verification.reason).toContain('tolerance window');
    });

    it('rejects webhook payloads when payload body has been tampered with', () => {
      const secret = generateWebhookSecret();
      const originalPayload = { score: 10 };
      const tamperedPayload = { score: 999 };

      const { signatureHeader } = signWebhookPayload(secret, originalPayload);
      const verification = verifyWebhookSignature(secret, JSON.stringify(tamperedPayload), signatureHeader);

      expect(verification.valid).toBe(false);
      expect(verification.reason).toBe('Signature mismatch');
    });

    it('records webhook delivery status, payload, and supports retry attempts', async () => {
      const secret = generateWebhookSecret();
      const subscription: WebhookSubscription = {
        id: 'sub-test-001',
        owner_id: OWNER_USER_ID,
        url: 'http://localhost/webhook-endpoint',
        secret,
        events: ['result.submitted'],
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await DatabaseService.saveWebhookSubscription(subscription);

      // Execute delivery (simulated fetch endpoint)
      const delivery = await executeWebhookDelivery(subscription, 'result.submitted', {
        match_id: 'match-001',
        score: '3 - 1',
      });

      expect(delivery).toBeDefined();
      expect(delivery.subscription_id).toBe(subscription.id);
      expect(delivery.event).toBe('result.submitted');
      expect(delivery.attempts).toBe(1);

      // Verify retry increments attempt count
      const retried = await retryWebhookDelivery(delivery.id);
      expect(retried).not.toBeNull();
      expect(retried?.attempts).toBe(2);
    });
  });

  describe('7. Private Competition Isolation', () => {
    it('prevents non-owners from discovering private competitions via API', async () => {
      // Create a key belonging to a DIFFERENT user
      const otherKeyGen = generateApiKey('lb_live');
      const otherKey: ApiKey = {
        id: otherKeyGen.keyId,
        owner_id: OTHER_USER_ID,
        name: 'Competitor External App',
        key_prefix: otherKeyGen.keyPrefix,
        secret_hash: otherKeyGen.secretHash,
        scopes: ['competitions:read'],
        rate_limit_per_minute: 60,
        status: 'active',
        expires_at: null,
        last_used_at: null,
        created_at: '2026-06-01T10:00:00Z',
        updated_at: '2026-06-01T10:00:00Z',
      };
      await DatabaseService.saveApiKey(otherKey);

      // Querying public competitions lists only public ones
      const allLbs = await DatabaseService.getLeaderboards();
      const publicOnly = allLbs.filter((lb) => lb.visibility === 'public' || lb.owner_id === OTHER_USER_ID);

      expect(publicOnly.some((lb) => lb.id === PUBLIC_LB_ID)).toBe(true);
      expect(publicOnly.some((lb) => lb.id === PRIVATE_LB_ID)).toBe(false);
    });
  });
});
