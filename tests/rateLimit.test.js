import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Unit tests for the rate limiter ──────────────────────────────────

// We need to test the module in isolation, so we import it fresh.
// The module uses an internal Map, so we rely on module-level state.
import { checkRateLimit } from '../src/backend/utils/rateLimit.js';

describe('rateLimit: checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows requests under the limit', () => {
    const result = checkRateLimit('test-user@example.com', { maxRequests: 3, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks requests over the limit', () => {
    const opts = { maxRequests: 3, windowMs: 60000 };
    checkRateLimit('over@example.com', opts);
    checkRateLimit('over@example.com', opts);
    checkRateLimit('over@example.com', opts);
    const result = checkRateLimit('over@example.com', opts);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window expires', () => {
    const opts = { maxRequests: 2, windowMs: 60000 };
    checkRateLimit('reset@example.com', opts);
    checkRateLimit('reset@example.com', opts);

    // Should be blocked now
    expect(checkRateLimit('reset@example.com', opts).allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(61000);

    // Should be allowed again
    const result = checkRateLimit('reset@example.com', opts);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('tracks different keys independently', () => {
    const opts = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit('user-a@example.com', opts);
    expect(checkRateLimit('user-a@example.com', opts).allowed).toBe(false);
    expect(checkRateLimit('user-b@example.com', opts).allowed).toBe(true);
  });

  it('uses sliding window — old entries expire individually', () => {
    const opts = { maxRequests: 2, windowMs: 60000 };

    // t=0: first request
    checkRateLimit('slide@example.com', opts);

    // t=30s: second request
    vi.advanceTimersByTime(30000);
    checkRateLimit('slide@example.com', opts);

    // t=30s: blocked
    expect(checkRateLimit('slide@example.com', opts).allowed).toBe(false);

    // t=61s: first request expired, one slot opens
    vi.advanceTimersByTime(31000);
    const result = checkRateLimit('slide@example.com', opts);
    expect(result.allowed).toBe(true);
  });

  it('returns correct retryAfterMs when blocked', () => {
    const opts = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit('retry@example.com', opts);

    vi.advanceTimersByTime(10000); // 10s later

    const result = checkRateLimit('retry@example.com', opts);
    expect(result.allowed).toBe(false);
    // Should be ~50s remaining (60s window - 10s elapsed)
    expect(result.retryAfterMs).toBeGreaterThanOrEqual(49000);
    expect(result.retryAfterMs).toBeLessThanOrEqual(51000);
  });

  it('uses separate namespaces for lookup vs submit', () => {
    const opts = { maxRequests: 1, windowMs: 60000 };
    checkRateLimit('lookup:shared@example.com', opts);
    expect(checkRateLimit('lookup:shared@example.com', opts).allowed).toBe(false);
    // Different prefix, same email — should be allowed
    expect(checkRateLimit('submit:shared@example.com', opts).allowed).toBe(true);
  });
});

// ── Integration: rate limiting in returnsService endpoints ───────────

const mockItems = [];
const mockQuery = {
  eq: vi.fn().mockReturnThis(),
  ne: vi.fn().mockReturnThis(),
  descending: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  find: vi.fn(async () => ({ items: mockItems, totalCount: mockItems.length })),
};

vi.mock('wix-data', () => ({
  default: {
    query: vi.fn(() => ({ ...mockQuery })),
    insert: vi.fn(async (collection, record) => ({ ...record, _id: 'return-new', _createdDate: new Date() })),
  },
}));

vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => ({ _id: 'member-001' })),
    getRoles: vi.fn(async () => []),
  },
}));

vi.mock('wix-web-module', () => ({
  Permissions: { Anyone: 'Anyone', SiteMember: 'SiteMember', Admin: 'Admin' },
  webMethod: (_perm, fn) => fn,
}));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (str, maxLen = 1000) => {
    if (typeof str !== 'string') return '';
    return str.replace(/<[^>]*>/g, '').trim().slice(0, maxLen);
  },
  validateId: (id) => {
    if (typeof id !== 'string') return '';
    const cleaned = id.trim().slice(0, 50);
    return /^[a-zA-Z0-9_-]+$/.test(cleaned) ? cleaned : '';
  },
  validateEmail: (email) => {
    if (typeof email !== 'string') return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  },
}));

// Mock the rate limiter for integration tests so we can control it
vi.mock('backend/utils/rateLimit', () => {
  let blocked = false;
  return {
    checkRateLimit: vi.fn(() => {
      if (blocked) return { allowed: false, remaining: 0, retryAfterMs: 30000 };
      return { allowed: true, remaining: 5, retryAfterMs: 0 };
    }),
    _setBlocked: (val) => { blocked = val; },
  };
});

describe('returnsService: rate limiting integration', () => {
  let lookupReturn, submitGuestReturn;
  let rateLimitMock;

  beforeEach(async () => {
    const mod = await import('../src/backend/returnsService.web.js');
    lookupReturn = mod.lookupReturn;
    submitGuestReturn = mod.submitGuestReturn;
    rateLimitMock = await import('backend/utils/rateLimit');
    rateLimitMock.checkRateLimit.mockClear();
  });

  it('lookupReturn returns rate limit error when blocked', async () => {
    rateLimitMock._setBlocked(true);
    const result = await lookupReturn('ORD-123', 'test@example.com');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
    rateLimitMock._setBlocked(false);
  });

  it('lookupReturn calls checkRateLimit with lookup: prefix', async () => {
    await lookupReturn('ORD-123', 'test@example.com');
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      'lookup:test@example.com',
      expect.objectContaining({ maxRequests: 10 }),
    );
  });

  it('submitGuestReturn returns rate limit error when blocked', async () => {
    rateLimitMock._setBlocked(true);
    const result = await submitGuestReturn({
      orderNumber: 'ORD-123',
      email: 'test@example.com',
      items: [{ lineItemId: 'item-1', quantity: 1 }],
      reason: 'defective',
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many requests/i);
    rateLimitMock._setBlocked(false);
  });

  it('submitGuestReturn calls checkRateLimit with submit: prefix', async () => {
    rateLimitMock._setBlocked(false);
    await submitGuestReturn({
      orderNumber: 'ORD-123',
      email: 'test@example.com',
      items: [{ lineItemId: 'item-1', quantity: 1 }],
      reason: 'defective',
    });
    expect(rateLimitMock.checkRateLimit).toHaveBeenCalledWith(
      'submit:test@example.com',
      expect.objectContaining({ maxRequests: 5 }),
    );
  });

  it('lookupReturn skips rate limit check for invalid email', async () => {
    const result = await lookupReturn('ORD-123', 'not-an-email');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/valid email/i);
    // Rate limit should NOT have been called — validation fails first
    expect(rateLimitMock.checkRateLimit).not.toHaveBeenCalled();
  });
});
