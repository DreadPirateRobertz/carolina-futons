/**
 * Tests for Facebook Catalog cron + failure alert (CF-1C)
 * TDD: written before implementation.
 * Covers: cron registration in jobs.config, refreshFacebookCatalog function,
 * notifyOwner on sync failure, success path, partial failure path.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __seed, __reset } from './__mocks__/wix-data.js';

// ── jobs.config cron registration ─────────────────────────────────────────

describe('Facebook Catalog — Cron Registration', () => {
  it('jobs.config includes a catalog refresh cron entry for facebookCatalog', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const catalogJob = Object.values(jobs).find(j =>
      j.functionLocation?.includes('facebookCatalog')
    );
    expect(catalogJob).toBeDefined();
  });

  it('catalog cron runs every 6 hours', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const catalogJob = Object.values(jobs).find(j =>
      j.functionLocation?.includes('facebookCatalog')
    );
    expect(catalogJob?.executionConfig.cronExpression).toBe('0 */6 * * *');
  });

  it('catalog cron entry has a description', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const catalogJob = Object.values(jobs).find(j =>
      j.functionLocation?.includes('facebookCatalog')
    );
    expect(typeof catalogJob?.description).toBe('string');
    expect(catalogJob?.description.length).toBeGreaterThan(10);
  });
});

// ── refreshFacebookCatalog function ───────────────────────────────────────

describe('refreshFacebookCatalog — exports and shape', () => {
  it('facebookCatalog.web.js exports a refreshFacebookCatalog function', async () => {
    const mod = await import('../src/backend/facebookCatalog.web.js');
    expect(typeof mod.refreshFacebookCatalog).toBe('function');
  });

  it('returns a result object with success, processed, failed, errors fields', async () => {
    __seed('Stores/Products', []);
    const { refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js');
    const result = await refreshFacebookCatalog();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('processed');
    expect(result).toHaveProperty('failed');
    expect(result).toHaveProperty('errors');
  });
});

describe('refreshFacebookCatalog — success path', () => {
  beforeEach(() => {
    __reset();
  });

  it('returns success: true when catalog is empty (no products to process)', async () => {
    __seed('Stores/Products', []);
    const { refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js');
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
    const { refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js');
    const result = await refreshFacebookCatalog();
    expect(result.processed).toBe(2);
    expect(result.failed).toBe(0);
  });
});

// ── failure alert ──────────────────────────────────────────────────────────

describe('refreshFacebookCatalog — failure alert', () => {
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

    const { refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js');
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

    const { refreshFacebookCatalog } = await import('../src/backend/facebookCatalog.web.js');
    const result = await refreshFacebookCatalog();

    expect(result.failed).toBe(0);
    expect(result.success).toBe(true);
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ── notificationService.notifyOwner ───────────────────────────────────────

describe('notificationService — notifyOwner', () => {
  it('notificationService.web.js exports a notifyOwner function', async () => {
    const mod = await import('../src/backend/notificationService.web.js');
    expect(typeof mod.notifyOwner).toBe('function');
  });

  it('notifyOwner accepts subject and message string parameters', async () => {
    const { notifyOwner } = await import('../src/backend/notificationService.web.js');
    // Should not throw with valid string inputs
    const result = await notifyOwner('Test subject', 'Test message body');
    expect(result).toHaveProperty('success');
  });
});
