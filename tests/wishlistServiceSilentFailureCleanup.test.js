/**
 * cf-44qt sibling — wishlistService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 5 webMethods
 * calls `logError('[wishlistService] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern from the
 * miquella cf-44qt audit memo (PRs #1387 emailService /
 * #1389 referralService / #1392 warrantyService).
 *
 * 5 tests = 1 per webMethod (addToWishlist, removeFromWishlist,
 * getWishlist, getWishlistByMemberId, isOnWishlist).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
// checkRateLimit returns { allowed: true } — callsite destructures
// `const { allowed } = await checkRateLimit(...)` so the mock must
// match that key (not the more-common `{ ok }` shape).
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
vi.mock('wix-members-backend', () => ({
  currentMember: { getMember: vi.fn(async () => ({ _id: 'member-1', loginEmail: 'm@example.com' })) },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — wishlistService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('addToWishlist wires logError on Wishlist insert throw', async () => {
    // addToWishlist first runs a duplicate-check query (which returns
    // empty since we haven't seeded anything), then calls insert.
    // __setInsertError makes the insert throw — that's the catch path
    // we're pinning.
    __setInsertError('Wishlist', new Error('wixData insert failure'));
    const mod = await import('../src/backend/wishlistService.web.js');
    // Signature is positional: (productId, name, price, opts).
    await mod.addToWishlist('p-1', 'Test Product', 100);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wishlistService/);
    expect(allTags).toMatch(/addToWishlist/);
    expect(allTags).toMatch(/failed/);
  });

  it('removeFromWishlist wires logError on Wishlist query throw', async () => {
    // removeFromWishlist queries first, then removes if found.
    // Inject a query error so the catch fires on the lookup.
    __setQueryError('Wishlist', new Error('wixData query failure'));
    const mod = await import('../src/backend/wishlistService.web.js');
    await mod.removeFromWishlist('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wishlistService/);
    expect(allTags).toMatch(/removeFromWishlist/);
  });

  it('getWishlist wires logError on Wishlist query throw', async () => {
    __setQueryError('Wishlist', new Error('wixData query failure'));
    const mod = await import('../src/backend/wishlistService.web.js');
    await mod.getWishlist();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wishlistService/);
    expect(allTags).toMatch(/getWishlist\b/);
  });

  it('getWishlistByMemberId wires logError on Wishlist query throw', async () => {
    __setQueryError('Wishlist', new Error('wixData query failure'));
    const mod = await import('../src/backend/wishlistService.web.js');
    await mod.getWishlistByMemberId('member-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wishlistService/);
    expect(allTags).toMatch(/getWishlistByMemberId/);
  });

  it('isOnWishlist wires logError on Wishlist query throw', async () => {
    __setQueryError('Wishlist', new Error('wixData query failure'));
    const mod = await import('../src/backend/wishlistService.web.js');
    await mod.isOnWishlist('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/wishlistService/);
    expect(allTags).toMatch(/isOnWishlist/);
  });
});
