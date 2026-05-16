/**
 * cf-44qt sibling — protectionPlan.web.js observability cleanup.
 *
 * Pins post-migration contract: every catch in the 4 webMethods
 * calls `logError('[protectionPlan] <fn> failed', err)` instead of
 * raw `console.error`. Mirrors the canonical pattern.
 *
 * 4 tests = 1 per webMethod. All 4 query the
 * `ProtectionPlanSelections` collection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({
  sanitize: (s) => s,
  validateId: (s) => s,
}));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('backend/utils/auditLog', () => ({
  logAuditEvent: vi.fn(async () => {}),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset as resetData,
  __setQueryError,
  __seed,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — protectionPlan.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    resetData();
  });

  it('getProtectionPlans wires logError on ProtectionPlanSelections query throw', async () => {
    __setQueryError('ProtectionPlanSelections', new Error('wixData query failure'));
    const mod = await import('../src/backend/protectionPlan.web.js');
    await mod.getProtectionPlans(['p-1', 'p-2'], 'session-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/protectionPlan/);
    expect(allTags).toMatch(/getProtectionPlans/);
    expect(allTags).toMatch(/failed/);
  });

  it('addProtectionPlan wires logError on ProtectionPlanSelections query throw', async () => {
    // Seed the Stores/Products record so the wixData.get gate doesn't
    // short-circuit before the catch can fire on the selections query.
    __seed('Stores/Products', [{ _id: 'p-1', name: 'Test Frame', price: 1000 }]);
    __setQueryError('ProtectionPlanSelections', new Error('wixData query failure'));
    const mod = await import('../src/backend/protectionPlan.web.js');
    await mod.addProtectionPlan('p-1', 'basic', 'session-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/protectionPlan/);
    expect(allTags).toMatch(/addProtectionPlan/);
  });

  it('removeProtectionPlan wires logError on ProtectionPlanSelections query throw', async () => {
    __setQueryError('ProtectionPlanSelections', new Error('wixData query failure'));
    const mod = await import('../src/backend/protectionPlan.web.js');
    await mod.removeProtectionPlan('p-1', 'session-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/protectionPlan/);
    expect(allTags).toMatch(/removeProtectionPlan/);
  });

  it('getProtectionPlanSummary wires logError on ProtectionPlanSelections query throw', async () => {
    __setQueryError('ProtectionPlanSelections', new Error('wixData query failure'));
    const mod = await import('../src/backend/protectionPlan.web.js');
    await mod.getProtectionPlanSummary('session-1');
    expect(logErrorSpy).toHaveBeenCalled();
    const allTags = logErrorSpy.mock.calls.map((c) => c[0]).join('|');
    expect(allTags).toMatch(/protectionPlan/);
    expect(allTags).toMatch(/getProtectionPlanSummary/);
  });
});
