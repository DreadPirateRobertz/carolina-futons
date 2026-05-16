/**
 * cf-44qt sibling — guestCheckout.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 3 webMethods
 * calls `logError('[guestCheckout] <fn> failed', err)` (or
 * `[guestCheckout] linkGuestOrdersToMember per-order failed for <id>`
 * for the inner per-item catch). Mirrors the canonical pattern
 * established in my 2026-05-16 audit memo + 5-PR sibling cluster.
 *
 * 3 tests = 1 per webMethod with a catch block reachable via
 * __setQueryError on the GuestOrders collection.
 *   - saveGuestSession (insert/upsert path)
 *   - linkGuestOrdersToMember (query path — IDOR pre-checks must pass)
 *   - getGuestOrdersByEmail (query path)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));
// linkGuestOrdersToMember's IDOR check requires member.loginEmail ===
// the supplied email. Mock returns a member with the test email so the
// catch reaches the wixData query path.
vi.mock('wix-members-backend', () => ({
  currentMember: {
    getMember: vi.fn(async () => ({
      _id: 'member-1',
      loginEmail: 'guest@example.com',
    })),
  },
}));

import {
  __reset as resetData,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — guestCheckout.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('saveGuestSession wires logError on GuestOrders insert throw', async () => {
    __setInsertError('GuestOrders', new Error('wixData insert failure'));
    // Also set query error so the upsert-style lookup-then-insert path
    // throws regardless of which side fires first.
    __setQueryError('GuestOrders', new Error('wixData query failure'));
    const mod = await import('../src/backend/guestCheckout.web.js');
    await mod.saveGuestSession({ sessionId: 's-1', email: 'guest@example.com', orderId: 'o-1' });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/guestCheckout/);
    expect(allTags).toMatch(/saveGuestSession/);
    expect(allTags).toMatch(/failed/);
  });

  it('linkGuestOrdersToMember wires logError on GuestOrders query throw', async () => {
    __setQueryError('GuestOrders', new Error('wixData query failure'));
    const mod = await import('../src/backend/guestCheckout.web.js');
    await mod.linkGuestOrdersToMember('guest@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/guestCheckout/);
    expect(allTags).toMatch(/linkGuestOrdersToMember/);
  });

  it('getGuestOrdersByEmail wires logError on GuestOrders query throw', async () => {
    __setQueryError('GuestOrders', new Error('wixData query failure'));
    const mod = await import('../src/backend/guestCheckout.web.js');
    await mod.getGuestOrdersByEmail('guest@example.com');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/guestCheckout/);
    expect(allTags).toMatch(/getGuestOrdersByEmail/);
  });
});
