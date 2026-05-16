/**
 * cf-44qt sibling — priceMatchService.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in the 5 webMethods
 * calls `logError('[priceMatchService] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern from the
 * miquella cf-44qt audit memo (PRs #1387 emailService /
 * #1389 referralService / #1392 warrantyService) and the
 * wishlistService sibling PR #1410.
 *
 * 4 tests cover the 4 webMethods reachable via the wix-data mock's
 * existing error helpers (query / insert / update). The 5th method
 * — getPriceMatchById — uses `wixData.get()` directly; the mock has
 * no __setGetError helper today, so the migration is mechanically
 * verified (1:1 console.error → logError + same tag shape) but no
 * runtime-throw test pins it. If __setGetError lands in
 * tests/__mocks__/wix-data.js later, add the pin.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
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
  __setUpdateError,
  __seed,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — priceMatchService.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('submitPriceMatchRequest wires logError on PriceMatches duplicate-check query throw', async () => {
    // submitPriceMatchRequest validates input, then queries PriceMatches
    // for a duplicate pending request. Inject a query error so the catch
    // fires on the duplicate-check.
    __setQueryError('PriceMatches', new Error('wixData query failure'));
    const mod = await import('../src/backend/priceMatchService.web.js');
    await mod.submitPriceMatchRequest({
      productId: 'p-1',
      productName: 'Test Product',
      competitorName: 'TestComp',
      ourPrice: 200,
      competitorPrice: 150,
    });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceMatchService/);
    expect(allTags).toMatch(/submitPriceMatchRequest/);
  });

  it('getMyPriceMatches wires logError on PriceMatches query throw', async () => {
    __setQueryError('PriceMatches', new Error('wixData query failure'));
    const mod = await import('../src/backend/priceMatchService.web.js');
    await mod.getMyPriceMatches();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceMatchService/);
    expect(allTags).toMatch(/getMyPriceMatches/);
  });

  it('reviewPriceMatchRequest wires logError on PriceMatches update throw', async () => {
    // Seed a pending record so the get succeeds + update path is reached.
    __seed('PriceMatches', [{
      _id: 'pm-1',
      status: 'pending',
      priceDifference: 50,
      claimNumber: 'PM-TEST-0001',
    }]);
    __setUpdateError('PriceMatches', new Error('wixData update failure'));
    const mod = await import('../src/backend/priceMatchService.web.js');
    await mod.reviewPriceMatchRequest('pm-1', 'approved', 'looks good');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceMatchService/);
    expect(allTags).toMatch(/reviewPriceMatchRequest/);
  });

  it('getPriceMatchStats wires logError on PriceMatches query throw', async () => {
    __setQueryError('PriceMatches', new Error('wixData query failure'));
    const mod = await import('../src/backend/priceMatchService.web.js');
    await mod.getPriceMatchStats();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/priceMatchService/);
    expect(allTags).toMatch(/getPriceMatchStats/);
  });
});
