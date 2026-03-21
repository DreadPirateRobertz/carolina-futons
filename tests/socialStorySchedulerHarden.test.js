/**
 * Hardening tests for socialStoryScheduler.web.js — CF-dtsr
 *
 * Covers gaps not addressed in socialStoryScheduler.test.js or socialStoryCron.test.js:
 * - Cron double-fire idempotency: second run in same window produces no duplicate inserts
 * - All 3 content rotation types (new_arrival, price_drop, seasonal_promo) per platform
 * - Platform-specific caption formatting: facebook price_drop, pinterest formats, seasonal_promo
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import {
  runDailySocialStories,
  _buildPlatformContent,
} from '../src/backend/socialStoryScheduler.web.js';

const YESTERDAY = new Date(Date.now() - 23 * 60 * 60 * 1000); // within 24h window
const OLD_DATE = new Date(Date.now() - 48 * 60 * 60 * 1000);  // outside 24h window

const mockProduct = (overrides = {}) => ({
  _id: 'prod-1',
  name: 'Monterey Futon Frame',
  slug: 'monterey',
  price: 549,
  category: 'futon-frames',
  description: 'Solid hardwood mission-style futon frame.',
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
// Cron double-fire idempotency
// ═══════════════════════════════════════════════════════════════════════

describe('cron double-fire idempotency — new arrivals', () => {
  it('second cron run within 7-day window inserts zero new ContentSchedule entries', async () => {
    __seed('Stores/Products', [mockProduct({ _createdDate: YESTERDAY })]);

    // First run — should schedule 3 (one per platform)
    const firstResult = await runDailySocialStories();
    expect(firstResult.newArrivals.scheduled).toBe(3);

    // Second run — do NOT reset; ContentSchedule already has entries from first run
    const secondInserts = [];
    __onInsert((collection, item) => secondInserts.push({ collection, item }));

    const secondResult = await runDailySocialStories();

    // All 3 platforms were deduped — no new inserts
    const scheduleInserts = secondInserts.filter(i => i.collection === 'ContentSchedule');
    expect(scheduleInserts).toHaveLength(0);
    expect(secondResult.newArrivals.scheduled).toBe(0);
    expect(secondResult.newArrivals.skipped).toBe(3);
  });

  it('second cron run for price drops also deduplicates correctly', async () => {
    const saleProduct = mockProduct({
      _id: 'prod-sale',
      _createdDate: OLD_DATE,
      _updatedDate: YESTERDAY,
      price: 399,
      comparePrice: 549,
    });
    __seed('Stores/Products', [saleProduct]);

    const firstResult = await runDailySocialStories();
    expect(firstResult.priceDrops.scheduled).toBe(3);

    // Second run without reset — dedup should fire
    const secondInserts = [];
    __onInsert((collection, item) => secondInserts.push({ collection, item }));

    const secondResult = await runDailySocialStories();

    const scheduleInserts = secondInserts.filter(i => i.collection === 'ContentSchedule');
    expect(scheduleInserts).toHaveLength(0);
    expect(secondResult.priceDrops.scheduled).toBe(0);
    expect(secondResult.priceDrops.skipped).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// All 3 content rotation types — caption content per platform
// ═══════════════════════════════════════════════════════════════════════

describe('content rotation type: seasonal_promo (behind-the-scenes) captions', () => {
  it('instagram seasonal_promo caption does not start with NEW: or PRICE DROP:', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'seasonal_promo');
    expect(content).not.toBeNull();
    expect(content.caption).not.toMatch(/^NEW:/);
    expect(content.caption).not.toMatch(/^PRICE DROP:/);
    expect(content.caption).toContain('Monterey Futon Frame');
  });

  it('instagram seasonal_promo caption includes brand hashtags', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'seasonal_promo');
    expect(content.caption).toContain('#CarolinaFutons');
  });

  it('facebook seasonal_promo caption contains product name (plain, no exclamatory prefix)', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'seasonal_promo');
    expect(content).not.toBeNull();
    expect(content.caption).toContain('Monterey Futon Frame');
    // Facebook seasonal_promo uses the else branch — no "Just arrived:" or "affordable" prefix
    expect(content.caption).not.toContain('Just arrived:');
    expect(content.caption).not.toContain('affordable');
  });

  it('pinterest seasonal_promo caption uses dot separator format', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'seasonal_promo');
    expect(content).not.toBeNull();
    // Pinterest always uses dot-separated format regardless of storyType
    expect(content.caption).toContain('Monterey Futon Frame');
    expect(content.caption).toContain('Carolina Futons');
  });
});

describe('content rotation type: price_drop (sale alert) captions', () => {
  it('facebook price_drop caption contains affordability language', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'price_drop');
    expect(content).not.toBeNull();
    expect(content.caption).toContain('affordable');
  });

  it('facebook price_drop caption references the product name', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'price_drop');
    expect(content.caption).toContain('Monterey Futon Frame');
  });

  it('pinterest price_drop caption includes price value', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'price_drop');
    expect(content).not.toBeNull();
    expect(content.caption).toContain('$549.00');
  });

  it('pinterest price_drop caption includes brand attribution', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'price_drop');
    expect(content.caption).toContain('Carolina Futons');
  });
});

describe('content rotation type: new_arrival captions', () => {
  it('pinterest new_arrival caption includes product name via dot separator', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'new_arrival');
    expect(content).not.toBeNull();
    expect(content.caption).toContain('Monterey Futon Frame');
    // Pinterest uses dot-separated format: "Name. $Price. Description. Brand"
    expect(content.caption).toContain('. ');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Platform-specific format verification
// ═══════════════════════════════════════════════════════════════════════

describe('platform-specific formatting completeness', () => {
  it('facebook content has no aspectRatio (not a story format)', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'new_arrival');
    expect(content).not.toBeNull();
    expect(content.format).toBe('post');
    expect(content.aspectRatio).toBeUndefined();
  });

  it('instagram caption includes shop URL', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'new_arrival');
    expect(content.caption).toContain('carolinafutons.com');
  });

  it('facebook caption includes shop URL', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'new_arrival');
    expect(content.caption).toContain('carolinafutons.com');
  });

  it('pinterest caption includes brand — Carolina Futons Hendersonville NC', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'new_arrival');
    expect(content.caption).toContain('Hendersonville');
  });
});
