import { describe, it, expect, beforeEach } from 'vitest';
import { __seed, __onInsert, __getInserted } from './__mocks__/wix-data.js';
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
});
