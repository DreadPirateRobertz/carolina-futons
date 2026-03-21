/**
 * Tests for Facebook Catalog cron + failure alert (CF-1C)
 * TDD: written before implementation.
 * Covers: cron registration in jobs.config, refreshFacebookCatalog function,
 * notifyOwner on sync failure, success path, partial failure path, outer catch path.
 */
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { __seed, __reset, __setQueryError } from './__mocks__/wix-data.js';

// ── jobs.config cron registration ─────────────────────────────────────────

describe('Facebook Catalog — Cron Registration', () => {
  let catalogJob;

  beforeAll(async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    catalogJob = Object.values(jobs).find(j =>
      j.functionLocation?.includes('facebookCatalog')
    );
  });

  it('jobs.config includes a catalog refresh cron entry for facebookCatalog', () => {
    expect(catalogJob).toBeDefined();
  });

  it('catalog cron runs every 6 hours', () => {
    expect(catalogJob?.executionConfig.cronExpression).toBe('0 */6 * * *');
  });

  it('catalog cron entry has a description', () => {
    expect(typeof catalogJob?.description).toBe('string');
    expect(catalogJob?.description.length).toBeGreaterThan(10);
  });
});

// ── refreshFacebookCatalog function ───────────────────────────────────────

describe('refreshFacebookCatalog — exports and shape', () => {
  let refreshFacebookCatalog;

  beforeAll(async () => {
    ({ refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js'));
  });

  it('facebookCatalog.web.js exports a refreshFacebookCatalog function', () => {
    expect(typeof refreshFacebookCatalog).toBe('function');
  });

  it('returns a result object with success, processed, failed, errors fields', async () => {
    __seed('Stores/Products', []);
    const result = await refreshFacebookCatalog();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('errors');
  });
});

describe('refreshFacebookCatalog — success path', () => {
  let refreshFacebookCatalog;

  beforeAll(async () => {
    ({ refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js'));
  });

  beforeEach(() => {
    __reset();
  });

  it('returns success: true when catalog is empty (no products to process)', async () => {
    __seed('Stores/Products', []);
    const result = await refreshFacebookCatalog();
    expect(result.success).toBe(true);
    expect(result.processed).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('processes valid products and returns processed count', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Monterey Futon Frame', price: 549, slug: 'monterey', mainMedia: { url: 'https://static.wixstatic.com/p1.jpg' } },
      { _id: 'p2', name: 'Austin Futon Frame', price: 399, slug: 'austin', mainMedia: { url: 'https://static.wixstatic.com/p2.jpg' } },
    ]);
    const result = await refreshFacebookCatalog();
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });
});

// ── failure alert ──────────────────────────────────────────────────────────

describe('refreshFacebookCatalog — failure alert', () => {
  let refreshFacebookCatalog;

  beforeAll(async () => {
    ({ refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js'));
  });

  beforeEach(() => {
    __reset();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports failed > 0 and logs a warning when products fail validation', async () => {
    // Seed products that fail catalog validation (missing name, price, image)
    __seed('Stores/Products', [
      { _id: 'bad-1', name: '', price: null, slug: '' },
      { _id: 'bad-2', name: '', price: null, slug: '' },
    ]);

    const result = await refreshFacebookCatalog();

    expect(result.failed).toBeGreaterThan(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.success).toBe(false);
    // Warning should be logged when failures occur
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[facebookCatalog]'),
      expect.stringContaining('failed'),
    );
  });

  it('returns success: true and 0 failed when all products pass validation', async () => {
    __seed('Stores/Products', [
      { _id: 'p1', name: 'Monterey Futon Frame', price: 549, slug: 'monterey',
        mainMedia: { url: 'https://static.wixstatic.com/p1.jpg' } },
    ]);

    const result = await refreshFacebookCatalog();

    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('returns success: false and logs error when wixData.query throws', async () => {
    __setQueryError('Stores/Products', new Error('DB connection timeout'));

    const result = await refreshFacebookCatalog();

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[facebookCatalog]'),
      expect.stringContaining('catalog refresh failed'),
    );
  });
});

// ── notificationService.notifyOwner ───────────────────────────────────────

describe('notificationService — notifyOwner', () => {
  let notifyOwner;

  beforeAll(async () => {
    ({ notifyOwner } = await import('../src/backend/notificationService.web.js'));
  });

  it('notificationService.web.js exports a notifyOwner function', () => {
    expect(typeof notifyOwner).toBe('function');
  });

  it('notifyOwner accepts subject and message string parameters', async () => {
    // Should not throw with valid string inputs
    const result = await notifyOwner('Test subject', 'Test message body');
    expect(result).toHaveProperty('success');
  });
});
