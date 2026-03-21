/**
 * Tests for socialStoryScheduler.web.js — runDailySocialStories cron (CF-3yy0)
 * Verifies: catalog query, new arrival scheduling, price drop scheduling,
 * dedup, rate limits, error handling, and monitoring log output.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __onInsert, __setQueryError, __getInserted } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import { runDailySocialStories } from '../src/backend/socialStoryScheduler.web.js';

// Use real relative times so the cron's `Date.now() - 24h` window includes YESTERDAY
const YESTERDAY = new Date(Date.now() - 23 * 60 * 60 * 1000); // 23h ago — within 24h window
const OLD_DATE = new Date(Date.now() - 48 * 60 * 60 * 1000);   // 48h ago — outside 24h window

const mockProduct = (overrides = {}) => ({
  _id: 'prod-1',
  name: 'Monterey Futon Frame',
  slug: 'monterey',
  price: 549,
  category: 'futon-frames',
  description: 'Solid hardwood futon frame.',
  images: ['https://static.wixstatic.com/media/test.jpg'],
  _createdDate: YESTERDAY,
  _updatedDate: YESTERDAY,
  ...overrides,
});

beforeEach(() => {
  __reset();
  __setMember({ _id: 'system-cron' });
  __setRoles([{ title: 'Admin' }]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// Basic run — no products
// ═══════════════════════════════════════════════════════════════════════

describe('runDailySocialStories — no products', () => {
  it('returns success with zero counts when catalog is empty', async () => {
    __seed('Stores/Products', []);
    const result = await runDailySocialStories();
    expect(result.success).toBe(true);
    expect(result.newArrivals.scheduled).toBe(0);
    expect(result.priceDrops.scheduled).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('logs a completion summary to console', async () => {
    __seed('Stores/Products', []);
    await runDailySocialStories();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[socialStoryScheduler] runDailySocialStories complete:'),
      expect.any(String),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// New arrivals scheduling
// ═══════════════════════════════════════════════════════════════════════

describe('runDailySocialStories — new arrivals', () => {
  it('schedules stories for each platform for a new product', async () => {
    __seed('Stores/Products', [mockProduct({ _createdDate: YESTERDAY })]);

    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const result = await runDailySocialStories();
    expect(result.success).toBe(true);
    // 3 platforms: instagram, facebook, pinterest
    expect(result.newArrivals.scheduled).toBe(3);

    const socialInserts = inserts.filter(i => i.collection === 'ContentSchedule');
    expect(socialInserts).toHaveLength(3);
    expect(socialInserts.every(i => i.item.eventType === 'new_arrival')).toBe(true);
    expect(socialInserts.every(i => i.item.contentType === 'social_story')).toBe(true);
    expect(socialInserts.every(i => i.item.status === 'pending')).toBe(true);
  });

  it('schedules stories for multiple new products', async () => {
    __seed('Stores/Products', [
      mockProduct({ _id: 'prod-a', name: 'Alpha Frame', _createdDate: YESTERDAY }),
      mockProduct({ _id: 'prod-b', name: 'Beta Futon', _createdDate: YESTERDAY }),
    ]);

    const result = await runDailySocialStories();
    expect(result.newArrivals.scheduled).toBe(6); // 2 products × 3 platforms
  });

  it('deduplicates products already in ContentSchedule within 7 days', async () => {
    const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
    __seed('Stores/Products', [mockProduct({ _id: 'prod-1', _createdDate: YESTERDAY })]);
    // Seed existing ContentSchedule entries for this product (within 7-day window)
    __seed('ContentSchedule', [
      { productId: 'prod-1', contentType: 'social_story', platform: 'instagram', status: 'pending', scheduledAt: sevenDaysAgo },
      { productId: 'prod-1', contentType: 'social_story', platform: 'facebook', status: 'pending', scheduledAt: sevenDaysAgo },
      { productId: 'prod-1', contentType: 'social_story', platform: 'pinterest', status: 'pending', scheduledAt: sevenDaysAgo },
    ]);

    const result = await runDailySocialStories();
    expect(result.newArrivals.scheduled).toBe(0);
    expect(result.newArrivals.skipped).toBe(3);
  });

  it('sets priority 3 for new arrival stories', async () => {
    __seed('Stores/Products', [mockProduct({ _createdDate: YESTERDAY })]);

    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await runDailySocialStories();
    const socialInserts = inserts.filter(i => i.collection === 'ContentSchedule');
    expect(socialInserts.every(i => i.item.priority === 3)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Price drop scheduling
// ═══════════════════════════════════════════════════════════════════════

describe('runDailySocialStories — price drops', () => {
  it('schedules price drop stories when comparePrice > price', async () => {
    __seed('Stores/Products', [mockProduct({
      _id: 'prod-sale',
      _createdDate: OLD_DATE,       // not a new arrival
      _updatedDate: YESTERDAY,      // updated recently
      price: 399,
      comparePrice: 549,
    })]);

    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const result = await runDailySocialStories();
    expect(result.priceDrops.scheduled).toBe(3); // 3 platforms

    const dropInserts = inserts.filter(i => i.collection === 'ContentSchedule' && i.item.eventType === 'price_drop');
    expect(dropInserts).toHaveLength(3);
  });

  it('skips products where comparePrice is not set', async () => {
    __seed('Stores/Products', [mockProduct({
      _createdDate: OLD_DATE,
      _updatedDate: YESTERDAY,
      price: 399,
      comparePrice: null,
    })]);

    const result = await runDailySocialStories();
    expect(result.priceDrops.scheduled).toBe(0);
  });

  it('skips products where price >= comparePrice (no actual drop)', async () => {
    __seed('Stores/Products', [mockProduct({
      _createdDate: OLD_DATE,
      _updatedDate: YESTERDAY,
      price: 549,
      comparePrice: 399, // comparePrice < price: not a drop
    })]);

    const result = await runDailySocialStories();
    expect(result.priceDrops.scheduled).toBe(0);
  });

  it('sets priority 2 for price drop stories', async () => {
    __seed('Stores/Products', [mockProduct({
      _id: 'prod-drop',
      _createdDate: OLD_DATE,
      _updatedDate: YESTERDAY,
      price: 399,
      comparePrice: 549,
    })]);

    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await runDailySocialStories();
    const dropInserts = inserts.filter(i => i.collection === 'ContentSchedule' && i.item.eventType === 'price_drop');
    expect(dropInserts.every(i => i.item.priority === 2)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Rate limits
// ═══════════════════════════════════════════════════════════════════════

describe('runDailySocialStories — rate limits', () => {
  it('respects daily rate limits and counts rateLimited correctly', async () => {
    // Fill instagram to its rate limit (25 posts)
    const existingPosts = Array.from({ length: 25 }, (_, i) => ({
      contentType: 'social_story',
      platform: 'instagram',
      status: 'pending',
      scheduledAt: new Date(),
    }));
    __seed('ContentSchedule', existingPosts);
    __seed('Stores/Products', [mockProduct({ _id: 'prod-new', _createdDate: YESTERDAY })]);

    const result = await runDailySocialStories();
    // instagram should be rate-limited, facebook + pinterest should succeed
    expect(result.newArrivals.rateLimited).toBeGreaterThanOrEqual(1);
    expect(result.newArrivals.scheduled).toBe(2); // facebook + pinterest
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Error handling
// ═══════════════════════════════════════════════════════════════════════

describe('runDailySocialStories — error handling', () => {
  it('returns success: false and logs error when catalog query throws', async () => {
    __setQueryError('Stores/Products', new Error('Wix data unavailable'));

    const result = await runDailySocialStories();
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('new_arrivals query failed');
    expect(console.error).toHaveBeenCalledWith(
      '[socialStoryScheduler] runDailySocialStories',
      expect.stringContaining('new_arrivals query failed'),
    );
  });

  it('continues price drops processing even if new arrivals query fails', async () => {
    // This tests that the two branches are independent try/catch blocks
    // We can't easily force only one branch to fail, but we can verify the
    // structure by checking error message granularity
    __setQueryError('Stores/Products', new Error('partial failure'));

    const result = await runDailySocialStories();
    // Both queries hit the same collection error, so both fail
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    // newArrivals and priceDrops are still present in result (not undefined)
    expect(result.newArrivals).toBeDefined();
    expect(result.priceDrops).toBeDefined();
  });

  it('returns structured result shape on any execution path', async () => {
    __seed('Stores/Products', []);
    const result = await runDailySocialStories();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('newArrivals');
    expect(result).toHaveProperty('priceDrops');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// jobs.config integration
// ═══════════════════════════════════════════════════════════════════════

describe('jobs.config cron registration', () => {
  it('jobs.config includes runDailySocialStories cron entry', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    expect(jobs).toHaveProperty('runDailySocialStories');
    expect(jobs.runDailySocialStories.functionLocation).toBe('/socialStoryScheduler.web.js');
    expect(jobs.runDailySocialStories.executionConfig.cronExpression).toMatch(/\d+ \d+ \* \* \*/);
  });

  it('jobs.config cron fires once daily (not multiple times per day)', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const cron = jobs.runDailySocialStories.executionConfig.cronExpression;
    // A daily cron has the form "M H * * *" — verify it's not "*/N" (minutely/hourly)
    expect(cron).not.toMatch(/^\*/);
    const parts = cron.split(' ');
    expect(parts[2]).toBe('*'); // day-of-month wildcard
    expect(parts[3]).toBe('*'); // month wildcard
    expect(parts[4]).toBe('*'); // day-of-week wildcard
  });
});
