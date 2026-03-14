import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Security: PII Export & GDPR Compliance Tests (cm-agm)
 *
 * Tests that PII-handling endpoints are properly secured:
 * - facebookCustomAudience requires secret header auth
 * - timingSafeEqual prevents timing attacks
 * - No PII leaks in public API responses
 * - Error responses don't disclose sensitive data
 * - lookupReturn doesn't leak order existence info
 */

const BACKEND_DIR = join(__dirname, '..', 'src', 'backend');
const HTTP_FUNCTIONS = join(BACKEND_DIR, 'http-functions.js');
const FB_CATALOG = join(BACKEND_DIR, 'facebookCatalog.web.js');
const RETURNS_SERVICE = join(BACKEND_DIR, 'returnsService.web.js');
const SANITIZE = join(BACKEND_DIR, 'utils', 'sanitize.js');

function readFile(path) {
  return readFileSync(path, 'utf-8');
}

// ── timingSafeEqual correctness ────────────────────────────────────────

describe('Security: timingSafeEqual implementation', () => {
  // Re-implement to test the logic (can't import from http-functions directly)
  function timingSafeEqualImpl(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
  }

  it('returns true for matching strings', () => {
    expect(timingSafeEqualImpl('secret123', 'secret123')).toBe(true);
  });

  it('returns false for non-matching strings of same length', () => {
    expect(timingSafeEqualImpl('secret123', 'secret124')).toBe(false);
  });

  it('returns false for different-length strings', () => {
    expect(timingSafeEqualImpl('short', 'longer-string')).toBe(false);
  });

  it('returns false for empty vs non-empty', () => {
    expect(timingSafeEqualImpl('', 'notempty')).toBe(false);
  });

  it('returns true for empty vs empty', () => {
    expect(timingSafeEqualImpl('', '')).toBe(true);
  });

  it('returns false for non-string inputs', () => {
    expect(timingSafeEqualImpl(null, 'test')).toBe(false);
    expect(timingSafeEqualImpl('test', undefined)).toBe(false);
    expect(timingSafeEqualImpl(123, 'test')).toBe(false);
    expect(timingSafeEqualImpl('test', {})).toBe(false);
  });

  it('returns false when first arg is not a string', () => {
    expect(timingSafeEqualImpl([], 'test')).toBe(false);
  });

  it('handles unicode correctly', () => {
    expect(timingSafeEqualImpl('héllo', 'héllo')).toBe(true);
    expect(timingSafeEqualImpl('héllo', 'hello')).toBe(false);
  });

  it('source code uses XOR-based constant-time comparison', () => {
    const src = readFile(HTTP_FUNCTIONS);
    // Must use XOR (^) for constant-time comparison
    expect(src).toMatch(/charCodeAt\(i\)\s*\^\s*\w+\.charCodeAt\(i\)/);
    // Must use OR (|) to accumulate differences
    expect(src).toMatch(/result\s*\|=\s*/);
  });
});

// ── facebookCustomAudience endpoint auth ────────────────────────────────

describe('Security: facebookCustomAudience authentication', () => {
  const src = readFile(HTTP_FUNCTIONS);

  it('requires x-fb-audience-secret header', () => {
    expect(src).toContain("request.headers['x-fb-audience-secret']");
  });

  it('uses timingSafeEqual for secret comparison', () => {
    expect(src).toMatch(/timingSafeEqual\(requestSecret,\s*audienceSecret\)/);
  });

  it('returns forbidden (not serverError) on auth failure', () => {
    const authBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_facebookCustomAudience') + 1000
    );
    expect(authBlock).toContain('forbidden(');
  });

  it('does not leak secret value in error response', () => {
    const authBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_facebookCustomAudience') + 1000
    );
    expect(authBlock).toMatch(/forbidden\(\{[^}]*error.*Unauthorized/);
    expect(authBlock).not.toMatch(/forbidden\(\{[^}]*audienceSecret/);
    expect(authBlock).not.toMatch(/forbidden\(\{[^}]*requestSecret/);
  });

  it('uses Cache-Control: no-store on PII response', () => {
    const fnBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_pinterestProductFeed')
    );
    expect(fnBlock).toContain("'Cache-Control': 'no-store'");
  });

  it('rejects when secret is not configured (audienceSecret is falsy)', () => {
    const fnBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_pinterestProductFeed')
    );
    expect(fnBlock).toMatch(/!audienceSecret\s*\|\|\s*!requestSecret/);
  });

  it('does not log PII data', () => {
    const fnBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_pinterestProductFeed')
    );
    expect(fnBlock).not.toMatch(/console\.(log|error|warn)\(.*customer/i);
    expect(fnBlock).not.toMatch(/console\.(log|error|warn)\(.*email/i);
    expect(fnBlock).not.toMatch(/console\.(log|error|warn)\(.*result\.customers/i);
  });
});

// ── PII exposure in exportCustomerAudienceData ──────────────────────────

describe('Security: exportCustomerAudienceData PII handling', () => {
  const src = readFile(FB_CATALOG);

  it('is protected by Permissions.Admin', () => {
    const exportIndex = src.indexOf('exportCustomerAudienceData');
    const block = src.substring(exportIndex, exportIndex + 200);
    expect(block).toContain('Permissions.Admin');
  });

  it('exports PII fields that are documented in schema', () => {
    const httpSrc = readFile(HTTP_FUNCTIONS);
    const schemaMatch = httpSrc.match(/schema:\s*\[([^\]]+)\]/);
    expect(schemaMatch).toBeTruthy();
    const fields = schemaMatch[1].replace(/'/g, '').split(',').map(f => f.trim());
    expect(fields).toContain('EMAIL');
    expect(fields).toContain('FN');
    expect(fields).toContain('LN');
    expect(fields).toContain('PHONE');
    expect(fields).toContain('CT');
    expect(fields).toContain('ST');
    expect(fields).toContain('ZIP');
    expect(fields).toContain('COUNTRY');
    expect(fields).toContain('VALUE');
  });

  it('normalizes email to lowercase', () => {
    expect(src).toContain('.toLowerCase().trim()');
  });

  it('strips non-digits from phone numbers', () => {
    expect(src).toMatch(/phone.*replace\(\/\\D\/g/);
  });

  it('does not expose raw order data in response', () => {
    const httpSrc = readFile(HTTP_FUNCTIONS);
    const fnBlock = httpSrc.substring(
      httpSrc.indexOf('get_facebookCustomAudience'),
      httpSrc.indexOf('get_pinterestProductFeed')
    );
    expect(fnBlock).not.toContain('allOrders');
    expect(fnBlock).not.toContain('order.billingInfo');
    expect(fnBlock).not.toContain('order.shippingInfo');
  });
});

// ── lookupReturn information disclosure ──────────────────────────────────

describe('Security: lookupReturn prevents information disclosure', () => {
  const src = readFile(RETURNS_SERVICE);

  it('uses Permissions.Anyone (publicly accessible)', () => {
    const lookupIndex = src.indexOf('export const lookupReturn');
    const block = src.substring(lookupIndex, lookupIndex + 200);
    expect(block).toContain('Permissions.Anyone');
  });

  it('sanitizes order number input', () => {
    expect(src).toMatch(/sanitize\(orderNumber/);
  });

  it('validates email format', () => {
    const lookupBlock = src.substring(
      src.indexOf('export const lookupReturn'),
      src.indexOf('export const submitGuestReturn')
    );
    expect(lookupBlock).toMatch(/validateEmail\(cleanEmail\)/);
  });

  it('returns same error for order-not-found and email-mismatch', () => {
    // SECURITY: Different error messages for "order not found" vs "wrong email"
    // allows an attacker to enumerate which order numbers exist.
    // Both should return an identical generic message.
    const lookupBlock = src.substring(
      src.indexOf('export const lookupReturn'),
      src.indexOf('export const submitGuestReturn')
    );

    const errorMessages = [];
    const errorRegex = /error:\s*'([^']+)'/g;
    let match;
    while ((match = errorRegex.exec(lookupBlock)) !== null) {
      errorMessages.push(match[1]);
    }

    // All "not found" error messages must be identical
    const notFoundErrors = errorMessages.filter(m => m.includes('not found'));
    expect(notFoundErrors.length).toBeGreaterThanOrEqual(2);
    const unique = [...new Set(notFoundErrors)];
    expect(unique).toHaveLength(1);
  });

  it('does not expose order details in error responses', () => {
    const lookupBlock = src.substring(
      src.indexOf('export const lookupReturn'),
      src.indexOf('export const submitGuestReturn')
    );
    expect(lookupBlock).not.toMatch(/error:.*buyerEmail/);
    expect(lookupBlock).not.toMatch(/error:.*order\._id/);
    expect(lookupBlock).not.toMatch(/error:.*order\.number/);
  });
});

// ── submitGuestReturn PII validation ─────────────────────────────────────

describe('Security: submitGuestReturn input validation', () => {
  const src = readFile(RETURNS_SERVICE);

  it('uses Permissions.Anyone', () => {
    const idx = src.indexOf('export const submitGuestReturn');
    const block = src.substring(idx, idx + 200);
    expect(block).toContain('Permissions.Anyone');
  });

  it('sanitizes order number', () => {
    const block = src.substring(
      src.indexOf('export const submitGuestReturn'),
      src.indexOf('export const submitGuestReturn') + 1500
    );
    expect(block).toMatch(/sanitize\(data\.orderNumber/);
  });

  it('validates email format', () => {
    const block = src.substring(
      src.indexOf('export const submitGuestReturn'),
      src.indexOf('export const submitGuestReturn') + 1500
    );
    expect(block).toMatch(/validateEmail\(cleanEmail\)/);
  });

  it('validates return reason against allowlist', () => {
    const block = src.substring(
      src.indexOf('export const submitGuestReturn'),
      src.indexOf('export const submitGuestReturn') + 1500
    );
    expect(block).toMatch(/VALID_REASONS/);
  });

  it('validates items array is non-empty', () => {
    const block = src.substring(
      src.indexOf('export const submitGuestReturn'),
      src.indexOf('export const submitGuestReturn') + 1500
    );
    expect(block).toMatch(/Array\.isArray/);
  });

  it('lookupReturn has rate limiting', () => {
    const block = src.substring(
      src.indexOf('export const lookupReturn'),
      src.indexOf('export const lookupReturn') + 1500
    );
    expect(block).toContain('_checkRateLimit');
  });

  it('submitGuestReturn has rate limiting', () => {
    const block = src.substring(
      src.indexOf('export const submitGuestReturn'),
      src.indexOf('export const submitGuestReturn') + 1500
    );
    expect(block).toContain('_checkRateLimit');
  });
});

// ── Cron endpoint secret auth (X-Cron-Secret header) ─────────────────────

describe('Security: cron endpoint secret exposure', () => {
  const src = readFile(HTTP_FUNCTIONS);

  const cronEndpoints = [
    'checkWishlistAlerts',
    'triggerBrowseRecoveryCron',
    'triggerCartRecoveryCron',
    'processEmailQueueCron',
    'triggerReengagementCron',
    'processPostPurchaseCareCron',
  ];

  cronEndpoints.forEach((endpoint) => {
    it(`${endpoint} uses timingSafeEqual for auth`, () => {
      const idx = src.indexOf(`get_${endpoint}`);
      const block = src.substring(idx, idx + 500);
      expect(block).toMatch(/timingSafeEqual\(requestKey,\s*cronKey\)/);
    });

    it(`${endpoint} returns forbidden on auth failure`, () => {
      const idx = src.indexOf(`get_${endpoint}`);
      const block = src.substring(idx, idx + 500);
      expect(block).toContain('forbidden(');
    });
  });

  it('cron secrets use X-Cron-Secret header (not query string)', () => {
    // Query strings are logged in access logs, cached by proxies,
    // and visible in browser history. Headers are the secure approach.
    const cronSecretInQuery = src.match(/request\.query\?\.key/g);
    expect(cronSecretInQuery).toBeNull();
  });

  cronEndpoints.forEach((endpoint) => {
    it(`${endpoint} reads secret from x-cron-secret header`, () => {
      const idx = src.indexOf(`get_${endpoint}`);
      const block = src.substring(idx, idx + 500);
      expect(block).toContain("request.headers?.['x-cron-secret']");
    });
  });

  it('facebookCustomAudience correctly uses header (not query)', () => {
    const fbBlock = src.substring(
      src.indexOf('get_facebookCustomAudience'),
      src.indexOf('get_pinterestProductFeed')
    );
    expect(fbBlock).toContain("request.headers['x-fb-audience-secret']");
    expect(fbBlock).not.toContain('request.query');
  });

  it('klaviyoWebhook correctly uses header (not query)', () => {
    const klaviyoBlock = src.substring(
      src.indexOf('post_klaviyoWebhook')
    );
    expect(klaviyoBlock).toContain("request.headers['x-klaviyo-webhook-secret']");
    expect(klaviyoBlock).not.toContain('request.query');
  });
});

// ── Public feed endpoints don't leak PII ────────────────────────────────

describe('Security: public feeds contain no PII', () => {
  const src = readFile(HTTP_FUNCTIONS);

  const publicFeeds = [
    { name: 'googleShoppingFeed', end: 'get_health' },
    { name: 'facebookCatalogFeed', end: 'get_facebookCustomAudience' },
    { name: 'pinterestProductFeed', end: 'get_manifest' },
  ];

  publicFeeds.forEach(({ name, end }) => {
    it(`${name} does not include customer email`, () => {
      const startIdx = src.indexOf(`get_${name}`);
      const endIdx = src.indexOf(`get_${end}`) || src.indexOf(end);
      const block = src.substring(startIdx, endIdx > startIdx ? endIdx : startIdx + 2000);
      expect(block).not.toMatch(/buyerInfo|buyerEmail|customer.*email/i);
    });

    it(`${name} does not require auth (public feed)`, () => {
      const startIdx = src.indexOf(`get_${name}`);
      const block = src.substring(startIdx, startIdx + 500);
      expect(block).not.toContain('timingSafeEqual');
      expect(block).not.toContain('getSecret');
    });
  });
});

// ── Error response safety ────────────────────────────────────────────────

describe('Security: error responses do not leak internals', () => {
  const src = readFile(HTTP_FUNCTIONS);

  it('serverError responses use generic messages', () => {
    const serverErrors = src.match(/serverError\(\{[^}]+\}/g) || [];
    serverErrors.forEach(errBlock => {
      expect(errBlock).not.toMatch(/err\.stack/);
      expect(errBlock).not.toMatch(/err\.message/);
    });
  });

  it('console.error does not log request secrets', () => {
    const consoleErrors = src.match(/console\.error\([^)]+\)/g) || [];
    consoleErrors.forEach(errCall => {
      expect(errCall).not.toContain('requestKey');
      expect(errCall).not.toContain('requestSecret');
      expect(errCall).not.toContain('cronKey');
      expect(errCall).not.toContain('audienceSecret');
    });
  });
});

// ── Sanitize module coverage for PII fields ──────────────────────────────

describe('Security: sanitize module handles PII edge cases', () => {
  const src = readFile(SANITIZE);

  it('sanitize() strips HTML tags', () => {
    expect(src).toContain('.replace(/<[^>]*>/g');
  });

  it('sanitize() handles double-encoded entities', () => {
    expect(src).toContain('Pass 2');
  });

  it('sanitize() enforces max length', () => {
    expect(src).toMatch(/\.slice\(0,\s*maxLen\)/);
  });

  it('validateEmail rejects strings without @ and domain', () => {
    // The regex in sanitize.js requires @ followed by domain with dot
    expect(src).toContain('@[^\\s@<>]+\\.[^\\s@<>]+');
  });

  it('validatePhone strips formatting characters', () => {
    expect(src).toMatch(/replace\(\/\[\\s\(\)\\-\+\.\]\/g/);
  });

  it('validateId only allows safe characters', () => {
    expect(src).toMatch(/\[a-zA-Z0-9_-\]\+/);
  });
});

// ── Returns service admin operations ────────────────────────────────────

describe('Security: returns admin operations are protected', () => {
  const src = readFile(RETURNS_SERVICE);

  const adminFunctions = [
    'getAdminReturns',
    'updateReturnStatus',
    'processRefund',
    'generateReturnLabel',
    'getReturnStats',
  ];

  adminFunctions.forEach((fn) => {
    it(`${fn} uses Permissions.Admin`, () => {
      const idx = src.indexOf(fn);
      expect(idx).not.toBe(-1);
      const block = src.substring(idx, idx + 200);
      expect(block).toContain('Permissions.Admin');
    });
  });
});

// ── Member-scoped data access ────────────────────────────────────────────

describe('Security: member data is scoped to current member', () => {
  const src = readFile(RETURNS_SERVICE);

  it('getMyReturns filters by current member ID', () => {
    const block = src.substring(
      src.indexOf('getMyReturns'),
      src.indexOf('getMyReturns') + 500
    );
    expect(block).toMatch(/\.eq\('memberId',\s*member\._id\)/);
  });

  it('getMyReturns returns empty array if no member', () => {
    const block = src.substring(
      src.indexOf('getMyReturns'),
      src.indexOf('getMyReturns') + 500
    );
    expect(block).toMatch(/if\s*\(!member\?\._id\)/);
    expect(block).toContain('returns: []');
  });

  it('getReturnByRma uses Permissions.SiteMember', () => {
    const idx = src.indexOf('getReturnByRma');
    const block = src.substring(idx, idx + 200);
    expect(block).toContain('Permissions.SiteMember');
  });
});
