/**
 * @module unsubToken
 * Utility for signing and verifying one-click unsubscribe tokens.
 *
 * Token format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 * The payload encodes { email, seq, exp } (exp = Unix seconds).
 *
 * CF-r9tf
 */

const SITE_URL = 'https://www.carolinafutons.com';

/** Token TTL: 30 days in milliseconds */
export const UNSUB_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sign an unsubscribe token.
 * @param {string} email
 * @param {string} seq - Sequence type ('all', 'welcome', 'reengagement', etc.)
 * @param {string} secret - HMAC secret key
 * @returns {Promise<string>} dot-separated base64url token
 */
export async function signUnsubToken(email, seq, secret) {
  const { createHmac } = await import('node:crypto');
  const exp = Math.floor((Date.now() + UNSUB_TOKEN_TTL_MS) / 1000);
  const payload = Buffer.from(JSON.stringify({ email, seq, exp })).toString('base64url');
  const sig = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify an unsubscribe token.
 * Returns decoded { email, seq } on success, or null on invalid/expired.
 * @param {string} token
 * @param {string} secret
 * @returns {Promise<{email: string, seq: string} | null>}
 */
export async function verifyUnsubToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx < 1) return null;

  const payload = token.slice(0, dotIdx);
  const givenSig = token.slice(dotIdx + 1);

  try {
    const { createHmac, timingSafeEqual: cryptoTSE } = await import('node:crypto');
    const expectedSig = createHmac('sha256', secret).update(payload).digest('base64url');

    // Constant-time comparison to prevent timing attacks
    const a = Buffer.from(givenSig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !cryptoTSE(a, b)) return null;

    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.email || !parsed.seq || !parsed.exp) return null;
    if (Math.floor(Date.now() / 1000) > parsed.exp) return null;

    return { email: parsed.email, seq: parsed.seq };
  } catch {
    return null;
  }
}

/**
 * Build a signed unsubscribe URL for inclusion in email footers.
 * @param {string} email
 * @param {string} seq
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function buildUnsubscribeUrl(email, seq, secret) {
  const token = await signUnsubToken(email, seq, secret);
  return `${SITE_URL}/_functions/unsubscribe?token=${encodeURIComponent(token)}`;
}
