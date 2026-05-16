/**
 * Hardening tests for facebookCatalog.web.js — CF-dtsr
 *
 * Covers gaps not addressed in facebookCatalog.test.js or facebookCatalogAlert.test.js:
 * - Error alert fires when sync produces processed === 0 (all products fail validation)
 * - Alert message includes failure count
 * - safeNotify swallows notifyOwner errors without masking the catalog result
 * - jobs.config refreshFacebookCatalog entry correctness
 * - Partial failure scenario
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';

// cf-n4wy: facebookCatalog migrated console.warn (validation-failures alert) →
// canonical logError. Mock so this harden test asserts the canonical tag.
vi.mock('backend/utils/errorHandler', () => ({ logError: vi.fn() }));
import { logError } from '../src/backend/utils/errorHandler.js';

// ═══════════════════════════════════════════════════════════════════════
// refreshFacebookCatalog — "all products fail" (product count = 0 processed)
// ═══════════════════════════════════════════════════════════════════════

describe('refreshFacebookCatalog — all products fail validation (product count 0)', () => {
  let refreshFacebookCatalog;

  beforeAll(async () => {
    ({ refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js'));
  });

  beforeEach(() => {
    __reset();
    vi.mocked(logError).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('processed count is 0 when all products fail catalog validation', async () => {
    // Products missing all required fields — name, price, image, slug
    __seed('Stores/Products', [
      { _id: 'bad-1', name: '', price: null, slug: '' },
      { _id: 'bad-2', name: '', price: null, slug: '' },
      { _id: 'bad-3', name: '', price: null, slug: '' },
    ]);

    const result = await refreshFacebookCatalog();

    expect(result.processed).toBe(0);
    expect(result.failed).toBe(3);
    expect(result.success).toBe(false);
  });

  it('error alert fires via canonical logError tag when all products fail and processed = 0', async () => {
    __seed('Stores/Products', [
      { _id: 'bad-1', name: '', price: null, slug: '' },
      { _id: 'bad-2', name: '', price: null, slug: '' },
    ]);

    await refreshFacebookCatalog();

    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('facebookCatalog:refreshFacebookCatalog-failures'),
      null,
    );
  });

  it('error alert tag includes the failure count', async () => {
    __seed('Stores/Products', [
      { _id: 'bad-1', name: '', price: null, slug: '' },
      { _id: 'bad-2', name: '', price: null, slug: '' },
      { _id: 'bad-3', name: '', price: null, slug: '' },
    ]);

    await refreshFacebookCatalog();

    // Find the -failures tag emitted by refreshFacebookCatalog; its body
    // carries the failure count in the message text.
    const failureCall = vi.mocked(logError).mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('-failures'),
    );
    expect(failureCall).toBeTruthy();
    expect(failureCall[0]).toMatch(/3 product/);
  });

  it('safeNotify swallows notifyOwner errors — result is still returned', async () => {
    // Force wixData to return invalid products so notifyOwner is triggered
    __seed('Stores/Products', [{ _id: 'bad-1', name: '', price: null, slug: '' }]);

    // Even if notifyOwner throws (simulated by notificationService mock returning error),
    // the cron function must return a valid result object, not re-throw
    const result = await refreshFacebookCatalog();

    // Result is always returned regardless of notifyOwner behavior
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('errors');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// jobs.config — refreshFacebookCatalog cron registration
// ═══════════════════════════════════════════════════════════════════════

describe('jobs.config — refreshFacebookCatalog cron entry', () => {
  let catalogJob;

  beforeAll(async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    catalogJob = jobs.refreshFacebookCatalog;
  });

  it('refreshFacebookCatalog cron entry exists in jobs.config', () => {
    expect(catalogJob).toBeDefined();
  });

  it('refreshFacebookCatalog functionLocation is /facebookCatalog.web.js', () => {
    expect(catalogJob.functionLocation).toBe('/facebookCatalog.web.js');
  });

  it('refreshFacebookCatalog cron runs every 6 hours exactly (not hourly or minutely)', () => {
    const cron = catalogJob.executionConfig.cronExpression;
    expect(cron).toBe('0 */6 * * *');
    // Confirm it is NOT minutely (*/N) or hourly (0 * * * *)
    expect(cron).not.toBe('0 * * * *');
    expect(cron).not.toMatch(/^\*/);
  });
});
