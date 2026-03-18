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
});
