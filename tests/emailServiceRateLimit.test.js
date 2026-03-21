/**
 * CF-rw9g: Email service rate limiting tests (TDD — tests first)
 *
 * Verifies that sendEmail, submitSwatchRequest, and sendSwatchConfirmationEmail
 * enforce rate limits per the newsletterService pattern: 3 calls/hour per email key.
 *
 * CMS collection: EmailRateLimit (key, count, windowStart)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── CMS Mock ──────────────────────────────────────────────────────────

let _collections = {};

function __seed(collection, items) {
  _collections[collection] = items.map((item, i) => ({ _id: `id-${i}`, ...item }));
}

vi.mock('wix-data', () => ({
  default: {
    query: (col) => {
      const items = _collections[col] || [];
      return {
        eq: (field, value) => ({
          limit: () => ({
            find: async () => ({
              items: items.filter(i => i[field] === value),
            }),
          }),
        }),
      };
    },
    insert: async (col, item) => {
      if (!_collections[col]) _collections[col] = [];
      const record = { _id: `id-${Date.now()}`, ...item };
      _collections[col].push(record);
      return record;
    },
    update: async (col, item) => {
      if (!_collections[col]) _collections[col] = [];
      const idx = _collections[col].findIndex(i => i._id === item._id);
      if (idx >= 0) _collections[col][idx] = item;
      return item;
    },
  },
}));

vi.mock('wix-crm-backend', () => ({
  triggeredEmails: {
    emailContact: vi.fn(async () => {}),
  },
  contacts: {
    queryContacts: () => ({
      eq: () => ({
        limit: () => ({
          find: async () => ({ items: [] }),
        }),
      }),
    }),
  },
}));

vi.mock('wix-secrets-backend', () => ({
  getSecret: vi.fn(async () => 'owner-contact-123'),
}));

vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => null) },
}));

vi.mock('backend/utils/sanitize', async () => {
  const actual = await vi.importActual('../src/backend/utils/sanitize.js');
  return actual;
});

// ── Import Module ─────────────────────────────────────────────────────

import {
  sendEmail,
  submitSwatchRequest,
  sendSwatchConfirmationEmail,
  EMAIL_RATE_LIMIT_MAX,
  EMAIL_RATE_LIMIT_WINDOW_MS,
  _checkEmailRateLimit,
} from '../src/backend/emailService.web.js';

// ── Fixtures ──────────────────────────────────────────────────────────

const validContactForm = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '828-555-0100',
  subject: 'Test Subject',
  message: 'This is a test message for rate limit testing.',
};

const validSwatchRequest = {
  name: 'Test User',
  email: 'test@example.com',
  address: '123 Main St, Asheville NC 28801',
  productId: 'prod-123',
  productName: 'Eureka Futon',
  swatchNames: ['Navy', 'Charcoal'],
};

const validSwatchConfirmation = {
  contactId: 'contact-abc',
  name: 'Test User',
  email: 'test@example.com',
  swatchNames: ['Navy'],
  productName: 'Eureka Futon',
};

// ── Setup ─────────────────────────────────────────────────────────────

beforeEach(() => {
  _collections = {};
  vi.clearAllMocks();
});

// ── Rate Limit Constants ─────────────────────────────────────────────

describe('rate limit constants', () => {
  it('exports EMAIL_RATE_LIMIT_MAX as 3', () => {
    expect(EMAIL_RATE_LIMIT_MAX).toBe(3);
  });

  it('exports EMAIL_RATE_LIMIT_WINDOW_MS as 1 hour', () => {
    expect(EMAIL_RATE_LIMIT_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});

// ── _checkEmailRateLimit ─────────────────────────────────────────────

describe('_checkEmailRateLimit', () => {
  it('allows first request for a new key', async () => {
    const result = await _checkEmailRateLimit('user@example.com');
    expect(result.allowed).toBe(true);
  });

  it('allows up to 3 requests within the window', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      const result = await _checkEmailRateLimit('user@example.com', { now });
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the 4th request within the window', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await _checkEmailRateLimit('user@example.com', { now });
    }
    const result = await _checkEmailRateLimit('user@example.com', { now });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('rate_limited');
  });

  it('resets the window after expiry', async () => {
    const now = Date.now();
    // Use up the limit
    for (let i = 0; i < 3; i++) {
      await _checkEmailRateLimit('user@example.com', { now });
    }
    // 4th blocked
    const blocked = await _checkEmailRateLimit('user@example.com', { now });
    expect(blocked.allowed).toBe(false);

    // Advance past window (1 hour + 1 ms)
    const afterWindow = now + EMAIL_RATE_LIMIT_WINDOW_MS + 1;
    const result = await _checkEmailRateLimit('user@example.com', { now: afterWindow });
    expect(result.allowed).toBe(true);
  });

  it('still blocks at exact window boundary (strict >)', async () => {
    const now = Date.now();
    for (let i = 0; i < 3; i++) {
      await _checkEmailRateLimit('user@example.com', { now });
    }
    // At exactly the window boundary (not past it) — should still be blocked
    const atBoundary = now + EMAIL_RATE_LIMIT_WINDOW_MS;
    const result = await _checkEmailRateLimit('user@example.com', { now: atBoundary });
    expect(result.allowed).toBe(false);
  });

  it('tracks different keys independently', async () => {
    const now = Date.now();
    // Fill up limit for user A
    for (let i = 0; i < 3; i++) {
      await _checkEmailRateLimit('a@example.com', { now });
    }
    const blockedA = await _checkEmailRateLimit('a@example.com', { now });
    expect(blockedA.allowed).toBe(false);

    // User B should still be allowed
    const resultB = await _checkEmailRateLimit('b@example.com', { now });
    expect(resultB.allowed).toBe(true);
  });

  it('normalizes email key to lowercase', async () => {
    const now = Date.now();
    await _checkEmailRateLimit('User@Example.COM', { now });
    await _checkEmailRateLimit('user@example.com', { now });
    await _checkEmailRateLimit('USER@EXAMPLE.COM', { now });
    // All count toward same key — 4th should be blocked
    const result = await _checkEmailRateLimit('user@example.com', { now });
    expect(result.allowed).toBe(false);
  });

  it('fails open on DB error', async () => {
    // Seed broken state that will cause query to fail
    _collections = null; // Force error in mock
    const result = await _checkEmailRateLimit('user@example.com');
    expect(result.allowed).toBe(true);
    _collections = {}; // Restore
  });
});

// ── sendEmail rate limiting ──────────────────────────────────────────

describe('sendEmail rate limiting', () => {
  it('allows a valid email send within limit', async () => {
    const result = await sendEmail(validContactForm);
    expect(result.success).toBe(true);
  });

  it('blocks email send after rate limit exceeded', async () => {
    const now = Date.now();
    // Exhaust the limit by sending 3 emails
    for (let i = 0; i < 3; i++) {
      await sendEmail(validContactForm);
    }
    // 4th should be rate limited
    const result = await sendEmail(validContactForm);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });

  it('still validates email before rate limiting', async () => {
    const result = await sendEmail({ ...validContactForm, email: 'not-an-email' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/invalid email/i);
  });
});

// ── submitSwatchRequest rate limiting ────────────────────────────────

describe('submitSwatchRequest rate limiting', () => {
  it('allows a valid swatch request within limit', async () => {
    const result = await submitSwatchRequest(validSwatchRequest);
    expect(result.success).toBe(true);
  });

  it('blocks swatch request after rate limit exceeded', async () => {
    for (let i = 0; i < 3; i++) {
      await submitSwatchRequest(validSwatchRequest);
    }
    const result = await submitSwatchRequest(validSwatchRequest);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });
});

// ── sendSwatchConfirmationEmail rate limiting ────────────────────────

describe('sendSwatchConfirmationEmail rate limiting', () => {
  it('allows a valid confirmation email within limit', async () => {
    const result = await sendSwatchConfirmationEmail(validSwatchConfirmation);
    expect(result.success).toBe(true);
  });

  it('blocks confirmation email after rate limit exceeded', async () => {
    for (let i = 0; i < 3; i++) {
      await sendSwatchConfirmationEmail(validSwatchConfirmation);
    }
    const result = await sendSwatchConfirmationEmail(validSwatchConfirmation);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });

  it('uses contactId as rate limit key when email is absent', async () => {
    const noEmailParams = { contactId: 'contact-xyz', name: 'Test', swatchNames: ['Navy'], productName: 'Futon' };
    for (let i = 0; i < 3; i++) {
      await sendSwatchConfirmationEmail(noEmailParams);
    }
    const result = await sendSwatchConfirmationEmail(noEmailParams);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });
});

// ── Cross-method rate limiting ───────────────────────────────────────

describe('cross-method rate limiting', () => {
  it('shares rate limit across sendEmail and submitSwatchRequest for same email', async () => {
    // 2 sendEmail + 1 submitSwatchRequest = 3 (limit)
    await sendEmail(validContactForm);
    await sendEmail(validContactForm);
    await submitSwatchRequest(validSwatchRequest);

    // 4th call (any method) should be blocked
    const result = await sendEmail(validContactForm);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });

  it('shares rate limit across all 3 methods for same email', async () => {
    await sendEmail(validContactForm);
    await submitSwatchRequest(validSwatchRequest);
    await sendSwatchConfirmationEmail(validSwatchConfirmation);

    // 4th call via any method should be blocked
    const result = await submitSwatchRequest(validSwatchRequest);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/too many|rate|try again/i);
  });
});
