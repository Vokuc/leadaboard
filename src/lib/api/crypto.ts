import crypto from 'crypto';

/**
 * Hash an API key or webhook secret using SHA-256.
 */
export function hashSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/**
 * Constant-time comparison to prevent timing attacks.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generate a new API Key with key ID, prefix, plaintext secret, and hashed secret.
 * Format: lb_live_<keyId>_<random32Hex>
 */
export function generateApiKey(prefix = 'lb_live'): {
  keyId: string;
  keyPrefix: string;
  plaintextSecret: string;
  secretHash: string;
} {
  const keyId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const secretRandom = crypto.randomBytes(24).toString('hex');
  const keyPrefix = `${prefix}_${keyId}`;
  const plaintextSecret = `${keyPrefix}_${secretRandom}`;
  const secretHash = hashSecret(plaintextSecret);

  return {
    keyId,
    keyPrefix,
    plaintextSecret,
    secretHash,
  };
}

/**
 * Generate a cryptographically strong secret for webhook signing.
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Sign a webhook payload using HMAC SHA-256.
 * Signature header format: t=<unix_seconds>,v1=<hex_hmac>
 */
export function signWebhookPayload(secret: string, payload: unknown, timestampSeconds = Math.floor(Date.now() / 1000)): {
  signatureHeader: string;
  timestamp: number;
  signature: string;
} {
  const rawPayload = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const signedData = `${timestampSeconds}.${rawPayload}`;
  const hmac = crypto.createHmac('sha256', secret).update(signedData).digest('hex');

  return {
    signatureHeader: `t=${timestampSeconds},v1=${hmac}`,
    timestamp: timestampSeconds,
    signature: hmac,
  };
}

export interface VerifyWebhookResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

/**
 * Verify an incoming webhook signature header against the raw body.
 * Checks for:
 * 1. Correct format (`t=...,v1=...`)
 * 2. Replay tolerance (default: 300 seconds / 5 minutes)
 * 3. Constant-time HMAC match
 */
export function verifyWebhookSignature(
  secret: string,
  rawPayload: string,
  signatureHeader: string | null | undefined,
  toleranceSeconds = 300
): VerifyWebhookResult {
  if (!signatureHeader || !signatureHeader.trim()) {
    return { valid: false, reason: 'Missing signature header' };
  }

  const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, item) => {
    const [k, v] = item.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const tStr = parts.t;
  const v1 = parts.v1;

  if (!tStr || !v1) {
    return { valid: false, reason: 'Malformed signature header format' };
  }

  const timestamp = parseInt(tStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: 'Invalid signature timestamp' };
  }

  // Replay protection: check timestamp drift
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    return { valid: false, reason: `Timestamp outside tolerance window of ${toleranceSeconds}s` };
  }

  // Compute expected HMAC
  const signedData = `${timestamp}.${rawPayload}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(signedData).digest('hex');

  if (!timingSafeEqualString(v1, expectedHmac)) {
    return { valid: false, reason: 'Signature mismatch' };
  }

  return { valid: true, timestamp };
}
