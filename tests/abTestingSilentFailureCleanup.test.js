/**
 * cf-44qt sibling — abTesting.web.js observability cleanup.
 *
 * Pins the post-migration contract: every catch in abTesting.web.js
 * calls `logError(context, err)` with a structured context label,
 * not raw `console.error`. The webMethod return shape stays the same
 * (`success: false` was already honest pre-migration — this PR only
 * upgrades the "observable" stage of the reachable→observable→honest
 * framing per feedback_reachable_observable_honest.md).
 *
 * Pattern source: cf-44qt PR #1366 internationalShippingSilentFailureCleanup.test.js.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const logErrorSpy = vi.fn();
vi.mock('backend/utils/errorHandler', () => ({ logError: logErrorSpy }));

vi.mock('backend/utils/sanitize', () => ({ sanitize: (s) => s }));
vi.mock('backend/utils/rateLimit', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}));
vi.mock('wix-web-module', () => ({
  Permissions: { Admin: 'Admin', SiteMember: 'SiteMember', Anyone: 'Anyone' },
  webMethod: (_perm, fn) => fn,
}));

import {
  __reset,
  __setQueryError,
  __setInsertError,
} from './__mocks__/wix-data.js';

describe('cf-44qt sibling — abTesting.web.js observability cleanup', () => {
  beforeEach(() => {
    logErrorSpy.mockClear();
    __reset();
  });

  it('getVariant wires logError on catch with abTesting.getVariant context', async () => {
    __setQueryError('AbTests', new Error('wixData failure'));
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.getVariant('myTest', 'visitor-1');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/^abTesting\.getVariant/);
  });

  it('trackEvent wires logError on catch with abTesting.trackEvent context', async () => {
    __setInsertError('AbEvents', new Error('wixData insert failure'));
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.trackEvent('myTest', 'control', 'visitor-1', 'impression');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/^abTesting\.trackEvent/);
  });

  it('getTestResults wires logError on catch with abTesting.getTestResults context', async () => {
    __setQueryError('AbTests', new Error('wixData failure'));
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.getTestResults('myTest');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/^abTesting\.getTestResults/);
  });

  it('concludeTest wires logError on catch with abTesting.concludeTest context', async () => {
    __setQueryError('AbTests', new Error('wixData failure'));
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.concludeTest('myTest', 'winner-id');
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/^abTesting\.concludeTest/);
  });

  it('createTest wires logError on catch with abTesting.createTest context', async () => {
    __setInsertError('AbTests', new Error('wixData insert failure'));
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.createTest({
      testName: 'myTest',
      variants: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    });
    expect(result.success).toBe(false);
    expect(logErrorSpy).toHaveBeenCalled();
    const [tag] = logErrorSpy.mock.calls[0];
    expect(tag).toMatch(/^abTesting\.createTest/);
  });

  it('early-return guard does NOT call logError (no spurious noise on missing inputs)', async () => {
    const mod = await import('../src/backend/abTesting.web.js');
    const result = await mod.getVariant('', '');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(logErrorSpy).not.toHaveBeenCalled();
  });
});
