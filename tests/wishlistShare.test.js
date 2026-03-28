<<<<<<< HEAD
/**
 * Wishlist Share backend — resolveShareToken web method tests (CF-y24r S1)
 * Tests: token validation, expiry, Wishlist fetch, error handling
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resolveShareToken } from '../src/backend/wishlistShare.web.js';
import {
  __seed,
  __reset,
  __setQueryError,
} from './__mocks__/wix-data.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days out
const PAST = new Date(Date.now() - 24 * 60 * 60 * 1000);        // 1 day ago

function makeToken(overrides = {}) {
  return {
    _id: 'tok-001',
    token: 'share-abc123',
    memberId: 'mem-001',
    memberName: 'Alice',
    expiresAt: FUTURE,
    ...overrides,
  };
}

function makeWishlistItem(overrides = {}) {
  return {
    _id: 'w-001',
    memberId: 'mem-001',
    productId: 'p-001',
    productName: 'Eureka Frame',
    productImage: 'https://example.com/eureka.jpg',
    addedDate: new Date('2026-01-15'),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveShareToken', () => {
  beforeEach(() => __reset());

  // ── Input validation ────────────────────────────────────────────────────────

  it('returns missing_token for null input', async () => {
    const result = await resolveShareToken(null);
    expect(result).toEqual({ valid: false, reason: 'missing_token' });
  });

  it('returns missing_token for undefined input', async () => {
    const result = await resolveShareToken(undefined);
    expect(result).toEqual({ valid: false, reason: 'missing_token' });
  });

  it('returns missing_token for empty string', async () => {
    const result = await resolveShareToken('');
    expect(result).toEqual({ valid: false, reason: 'missing_token' });
  });

  it('returns missing_token for whitespace-only string', async () => {
    const result = await resolveShareToken('   ');
    expect(result).toEqual({ valid: false, reason: 'missing_token' });
  });

  // ── Not found ───────────────────────────────────────────────────────────────

  it('returns not_found when collection is empty', async () => {
    __seed('WishlistShareTokens', []);
    const result = await resolveShareToken('nonexistent');
    expect(result).toEqual({ valid: false, reason: 'not_found' });
  });

  it('returns not_found when token does not match any record', async () => {
    __seed('WishlistShareTokens', [makeToken({ token: 'different-token' })]);
    const result = await resolveShareToken('share-abc123');
    expect(result).toEqual({ valid: false, reason: 'not_found' });
  });

  // ── Expiry ──────────────────────────────────────────────────────────────────

  it('returns expired when expiresAt is in the past', async () => {
    __seed('WishlistShareTokens', [makeToken({ expiresAt: PAST })]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result).toEqual({ valid: false, reason: 'expired' });
  });

  it('returns valid when expiresAt is in the future', async () => {
    __seed('WishlistShareTokens', [makeToken({ expiresAt: FUTURE })]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result.valid).toBe(true);
  });

  it('returns valid when expiresAt is null (no expiry)', async () => {
    __seed('WishlistShareTokens', [makeToken({ expiresAt: null })]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result.valid).toBe(true);
  });

  // ── Success: owner + items ───────────────────────────────────────────────────

  it('returns ownerName from the token record', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result.ownerName).toBe('Alice');
  });

  it('returns memberId from the token record', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result.memberId).toBe('mem-001');
  });

  it('returns wishlist items belonging to the token owner', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', [
      makeWishlistItem({ memberId: 'mem-001', productId: 'p-001' }),
      makeWishlistItem({ _id: 'w-002', memberId: 'mem-001', productId: 'p-002' }),
      makeWishlistItem({ _id: 'w-003', memberId: 'other-member', productId: 'p-003' }),
    ]);
    const result = await resolveShareToken('share-abc123');
    expect(result.items).toHaveLength(2);
    expect(result.items.map(i => i.productId)).toEqual(expect.arrayContaining(['p-001', 'p-002']));
  });

  it('returns empty items array when member has nothing wishlisted', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('share-abc123');
    expect(result.items).toEqual([]);
  });

  it('includes productId, productName, productImage in each item', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', [makeWishlistItem()]);
    const result = await resolveShareToken('share-abc123');
    const item = result.items[0];
    expect(item.productId).toBe('p-001');
    expect(item.productName).toBe('Eureka Frame');
    expect(item.productImage).toBe('https://example.com/eureka.jpg');
  });

  // ── Token trimming ──────────────────────────────────────────────────────────

  it('trims whitespace from token before lookup', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __seed('Wishlist', []);
    const result = await resolveShareToken('  share-abc123  ');
    expect(result.valid).toBe(true);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns not_found on database error', async () => {
    __setQueryError('WishlistShareTokens', new Error('DB unavailable'));
    const result = await resolveShareToken('share-abc123');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('returns valid but empty items on Wishlist query error', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    __setQueryError('Wishlist', new Error('DB unavailable'));
    const result = await resolveShareToken('share-abc123');
    expect(result.valid).toBe(true);
    expect(result.items).toEqual([]);
  });

  // ── Token max-length guard ───────────────────────────────────────────────────

  it('truncates oversized token to 200 chars before lookup (not_found expected)', async () => {
    __seed('WishlistShareTokens', []);
    const longToken = 'a'.repeat(500);
    const result = await resolveShareToken(longToken);
    // Won't find a match but must not throw or hang
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('not_found');
  });

  it('resolves valid token exactly 200 chars long', async () => {
    const tok200 = 'x'.repeat(200);
    __seed('WishlistShareTokens', [makeToken({ token: tok200 })]);
    __seed('Wishlist', []);
    const result = await resolveShareToken(tok200);
    expect(result.valid).toBe(true);
  });

  // ── Wishlist item limit ───────────────────────────────────────────────────────

  it('returns all items when member has exactly 100 wishlist items', async () => {
    __seed('WishlistShareTokens', [makeToken()]);
    const items = Array.from({ length: 100 }, (_, i) =>
      makeWishlistItem({ _id: `w-${i}`, productId: `p-${i}` })
    );
    __seed('Wishlist', items);
    const result = await resolveShareToken('share-abc123');
    expect(result.items).toHaveLength(100);
=======
import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __getInserted, __setQueryError, __setInsertError } from './__mocks__/wix-data.js';
import { __setMember } from './__mocks__/wix-members-backend.js';
import {
  generateShareToken,
  resolveShareToken,
} from '../src/backend/wishlistShare.web.js';

const MEMBER = { _id: 'mem-1', profile: { nickname: 'Alex', firstName: 'Alex' } };

beforeEach(() => {
  __seed('WishlistShareTokens', []);
  __seed('Wishlist', []);
  __seed('Members/FullData', []);
});

// ── generateShareToken ────────────────────────────────────────────

describe('generateShareToken', () => {
  it('returns error when not authenticated', async () => {
    const result = await generateShareToken();
    expect(result.error).toBe('Not authenticated');
  });

  it('creates a token record for authenticated member', async () => {
    __setMember(MEMBER);
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Sofa', productImage: 'img.jpg' },
    ]);

    let inserted = null;
    __onInsert((col, item) => {
      if (col === 'WishlistShareTokens') inserted = item;
    });

    const result = await generateShareToken();
    expect(result.error).toBeUndefined();
    expect(result.token).toBeTruthy();
    expect(result.shareUrl).toContain('?share=');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(inserted).not.toBeNull();
    expect(inserted.memberId).toBe('mem-1');
    expect(inserted.token).toBe(result.token);
  });

  it('defaults to 30-day expiry', async () => {
    __setMember(MEMBER);
    const before = Date.now();
    const result = await generateShareToken();
    const after = Date.now();
    const expiresMs = result.expiresAt.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(before + thirtyDays - 1000);
    expect(expiresMs).toBeLessThanOrEqual(after + thirtyDays + 1000);
  });

  it('accepts custom expiryDays', async () => {
    __setMember(MEMBER);
    const before = Date.now();
    const result = await generateShareToken({ expiryDays: 7 });
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const expiresMs = result.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + sevenDays - 1000);
    expect(expiresMs).toBeLessThanOrEqual(before + sevenDays + 5000);
  });

  it('clamps expiryDays 0 up to 1 day minimum', async () => {
    __setMember(MEMBER);
    const before = Date.now();
    const result = await generateShareToken({ expiryDays: 0 });
    const oneDay = 24 * 60 * 60 * 1000;
    const expiresMs = result.expiresAt.getTime();
    // Must be clamped to 1 day, NOT 30 days (the default)
    expect(expiresMs).toBeGreaterThanOrEqual(before + oneDay - 2000);
    expect(expiresMs).toBeLessThanOrEqual(before + oneDay + 5000);
  });

  it('clamps expiryDays 9999 down to 365 day maximum', async () => {
    __setMember(MEMBER);
    const before = Date.now();
    const result = await generateShareToken({ expiryDays: 9999 });
    const maxDay = 365 * 24 * 60 * 60 * 1000;
    const expiresMs = result.expiresAt.getTime();
    expect(expiresMs).toBeGreaterThanOrEqual(before + maxDay - 2000);
    expect(expiresMs).toBeLessThanOrEqual(before + maxDay + 5000);
  });

  it('token contains only URL-safe characters', async () => {
    __setMember(MEMBER);
    const { token } = await generateShareToken();
    expect(token).toMatch(/^[a-z0-9\-_]+$/);
  });
});

// ── resolveShareToken ─────────────────────────────────────────────

describe('resolveShareToken', () => {
  it('returns error for missing token', async () => {
    const result = await resolveShareToken(null);
    expect(result.error).toBe('Invalid token');
  });

  it('returns error for unknown token', async () => {
    const result = await resolveShareToken('no-such-token');
    expect(result.error).toBe('Invalid token');
  });

  it('returns error for expired token', async () => {
    const expiredAt = new Date(Date.now() - 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'expired-token', memberId: 'mem-1', expiresAt: expiredAt },
    ]);

    const result = await resolveShareToken('expired-token');
    expect(result.error).toBe('Token expired');
  });

  it('returns wishlist items and owner name for valid token', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'valid-token', memberId: 'mem-1', expiresAt },
    ]);
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Sofa', productImage: 'img1.jpg' },
      { _id: 'w2', memberId: 'mem-1', productId: 'p2', productName: 'Loveseat', productImage: 'img2.jpg' },
    ]);
    __seed('Members/FullData', [
      { _id: 'mem-1', profile: { nickname: 'Alex', firstName: 'Alex' } },
    ]);

    const result = await resolveShareToken('valid-token');
    expect(result.error).toBeUndefined();
    expect(result.items).toHaveLength(2);
    expect(result.items[0].productName).toBe('Sofa');
    expect(result.items[1].productName).toBe('Loveseat');
    expect(result.ownerName).toBe('Alex');
    expect(result.expiresAt).toEqual(expiresAt);
  });

  it('filters wishlist items to token owner only', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'valid-token', memberId: 'mem-1', expiresAt },
    ]);
    __seed('Wishlist', [
      { _id: 'w1', memberId: 'mem-1', productId: 'p1', productName: 'Sofa', productImage: 'img.jpg' },
      { _id: 'w2', memberId: 'mem-2', productId: 'p2', productName: 'Chair', productImage: 'img2.jpg' },
    ]);
    __seed('Members/FullData', [
      { _id: 'mem-1', profile: { nickname: 'Alex' } },
    ]);

    const result = await resolveShareToken('valid-token');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].productName).toBe('Sofa');
  });

  it('falls back to firstName when nickname is absent', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'valid-token', memberId: 'mem-1', expiresAt },
    ]);
    __seed('Wishlist', []);
    __seed('Members/FullData', [
      { _id: 'mem-1', profile: { firstName: 'Jordan' } },
    ]);

    const result = await resolveShareToken('valid-token');
    expect(result.ownerName).toBe('Jordan');
  });

  it('falls back to "A friend" when no profile name available', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'valid-token', memberId: 'mem-1', expiresAt },
    ]);
    __seed('Wishlist', []);
    __seed('Members/FullData', [
      { _id: 'mem-1', profile: {} },
    ]);

    const result = await resolveShareToken('valid-token');
    expect(result.ownerName).toBe('A friend');
  });

  it('sanitizes the token input (rejects overly long token)', async () => {
    const longToken = 'a'.repeat(200);
    const result = await resolveShareToken(longToken);
    expect(result.error).toBe('Invalid token');
  });

  it('rejects non-string token types (number)', async () => {
    const result = await resolveShareToken(42);
    expect(result.error).toBe('Invalid token');
  });

  it('rejects non-string token types (object)', async () => {
    const result = await resolveShareToken({});
    expect(result.error).toBe('Invalid token');
  });

  it('returns error when profile fetch throws (falls back to A friend)', async () => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    __seed('WishlistShareTokens', [
      { _id: 'tok-1', token: 'valid-token', memberId: 'mem-1', expiresAt },
    ]);
    __seed('Wishlist', []);
    __setQueryError('Members/FullData', new Error('CMS unavailable'));

    const result = await resolveShareToken('valid-token');
    expect(result.error).toBeUndefined();
    expect(result.ownerName).toBe('A friend');
  });
});

// ── generateShareToken — insert failure ───────────────────────────────

describe('generateShareToken — insert failure', () => {
  it('returns error when CMS insert throws', async () => {
    __setMember(MEMBER);
    __setInsertError(new Error('CMS write failed'));

    const result = await generateShareToken();
    expect(result.error).toBe('Failed to generate share link');
>>>>>>> origin/cf-wishlist-share-s1-s5
  });
});
