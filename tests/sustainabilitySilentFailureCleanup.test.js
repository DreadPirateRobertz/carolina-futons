/**
 * cf-44qt sibling — sustainability.web.js observability cleanup.
 *
 * Pins post-migration contract: every catch in the 4 webMethods
 * calls `logError('[sustainability] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern.
 *
 * 4 tests = 1 per webMethod. ProductSustainability + TradeInRequests
 * collections drive each catch path via __setQueryError.
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
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — sustainability.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getSustainabilityInfo wires logError on ProductSustainability query throw', async () => {
    __setQueryError('ProductSustainability', new Error('wixData query failure'));
    const mod = await import('../src/backend/sustainability.web.js');
    await mod.getSustainabilityInfo('p-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/sustainability/);
    expect(allTags).toMatch(/getSustainabilityInfo/);
    expect(allTags).toMatch(/failed/);
  });

  it('calculateCarbonOffset wires logError on ProductSustainability query throw', async () => {
    __setQueryError('ProductSustainability', new Error('wixData query failure'));
    const mod = await import('../src/backend/sustainability.web.js');
    await mod.calculateCarbonOffset(['p-1', 'p-2']);
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/sustainability/);
    expect(allTags).toMatch(/calculateCarbonOffset/);
  });

  it('submitTradeIn wires logError on TradeInRequests insert throw', async () => {
    __setInsertError('TradeInRequests', new Error('wixData insert failure'));
    const mod = await import('../src/backend/sustainability.web.js');
    await mod.submitTradeIn({
      productType: 'futon-frame',
      condition: 'good',
      photos: [],
    });
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/sustainability/);
    expect(allTags).toMatch(/submitTradeIn/);
  });

  it('getTradeInStatus wires logError on TradeInRequests query throw', async () => {
    __setQueryError('TradeInRequests', new Error('wixData query failure'));
    const mod = await import('../src/backend/sustainability.web.js');
    // No requestId → goes to the bulk query path that __setQueryError catches.
    await mod.getTradeInStatus();
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/sustainability/);
    expect(allTags).toMatch(/getTradeInStatus/);
  });
});
