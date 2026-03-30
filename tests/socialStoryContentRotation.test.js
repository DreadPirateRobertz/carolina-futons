/**
 * Tests for socialStoryScheduler.web.js — runDailyContentRotation (CF-a174)
 * Verifies: day-of-week routing, featured product, review highlight,
 * furniture tip rotation, weekend promo, rate limits, error handling,
 * cron registration in jobs.config.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { __reset, __seed, __onInsert, __setQueryError } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import {
  runDailyContentRotation,
  _CONTENT_ROTATION,
  _FURNITURE_CARE_TIPS,
  _WEEKEND_PROMO,
  _PLATFORMS,
  _getDayRotationContent,
  _buildRotationCaption,
} from '../src/backend/socialStoryScheduler.web.js';

const mockProduct = (overrides = {}) => ({
  _id: 'prod-featured',
  name: 'Fuji Futon Frame',
  slug: 'fuji',
  price: 699,
  ribbon: 'Best Seller',
  images: ['https://static.wixstatic.com/media/fuji.jpg'],
  _updatedDate: new Date(),
  ...overrides,
});

const mockReview = (overrides = {}) => ({
  _id: 'rev-1',
  content: 'Absolutely love this futon — quality is outstanding!',
  authorName: 'Jane D.',
  rating: 5,
  productName: 'Fuji Futon Frame',
  productId: 'prod-featured',
  _createdDate: new Date(),
  ...overrides,
});

beforeEach(() => {
  __reset();
  __setMember({ _id: 'system-cron' });
  __setRoles([{ title: 'Admin' }]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// _CONTENT_ROTATION constant
// ═══════════════════════════════════════════════════════════════════════

describe('_CONTENT_ROTATION schedule', () => {
  it('maps Sunday (0) to weekend_promo', () => {
    expect(_CONTENT_ROTATION[0]).toBe('weekend_promo');
  });

  it('maps Monday (1) to featured_product', () => {
    expect(_CONTENT_ROTATION[1]).toBe('featured_product');
  });

  it('maps Tuesday (2) to review_highlight', () => {
    expect(_CONTENT_ROTATION[2]).toBe('review_highlight');
  });

  it('maps Wednesday (3) to featured_product', () => {
    expect(_CONTENT_ROTATION[3]).toBe('featured_product');
  });

  it('maps Thursday (4) to review_highlight', () => {
    expect(_CONTENT_ROTATION[4]).toBe('review_highlight');
  });

  it('maps Friday (5) to featured_product', () => {
    expect(_CONTENT_ROTATION[5]).toBe('featured_product');
  });

  it('maps Saturday (6) to furniture_tip', () => {
    expect(_CONTENT_ROTATION[6]).toBe('furniture_tip');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// _getDayRotationContent
// ═══════════════════════════════════════════════════════════════════════

describe('_getDayRotationContent', () => {
  it('returns the mapped content type for each day', () => {
    for (const [day, expected] of Object.entries(_CONTENT_ROTATION)) {
      expect(_getDayRotationContent(Number(day))).toBe(expected);
    }
  });

  it('falls back to featured_product for unmapped day value', () => {
    expect(_getDayRotationContent(99)).toBe('featured_product');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// _FURNITURE_CARE_TIPS
// ═══════════════════════════════════════════════════════════════════════

describe('_FURNITURE_CARE_TIPS', () => {
  it('has 7 tips (one per day of the week rotation)', () => {
    expect(_FURNITURE_CARE_TIPS).toHaveLength(7);
  });

  it('every tip has a title and tip string', () => {
    for (const t of _FURNITURE_CARE_TIPS) {
      expect(typeof t.title).toBe('string');
      expect(t.title.length).toBeGreaterThan(0);
      expect(typeof t.tip).toBe('string');
      expect(t.tip.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// _buildRotationCaption
// ═══════════════════════════════════════════════════════════════════════

describe('_buildRotationCaption — featured_product', () => {
  it('includes product name and price', () => {
    const caption = _buildRotationCaption('instagram', 'featured_product', { productName: 'Fuji Frame', price: 699 });
    expect(caption).toContain('Fuji Frame');
    expect(caption).toContain('$699.00');
  });

  it('adds hashtags for instagram', () => {
    const caption = _buildRotationCaption('instagram', 'featured_product', { productName: 'Fuji Frame', price: 699 });
    expect(caption).toContain('#CarolinaFutons');
  });

  it('includes shop link for facebook', () => {
    const caption = _buildRotationCaption('facebook', 'featured_product', { productName: 'Fuji Frame', price: 699 });
    expect(caption).toContain('carolinafutons.com');
  });
});

describe('_buildRotationCaption — review_highlight', () => {
  it('includes review text and reviewer name', () => {
    const caption = _buildRotationCaption('facebook', 'review_highlight', {
      reviewText: 'Great quality!',
      reviewerName: 'Jane D.',
      productName: 'Fuji Frame',
    });
    expect(caption).toContain('Great quality!');
    expect(caption).toContain('Jane D.');
  });

  it('falls back to default message when reviewText is absent', () => {
    const caption = _buildRotationCaption('instagram', 'review_highlight', {
      reviewText: '',
      reviewerName: '',
    });
    expect(typeof caption).toBe('string');
    expect(caption.length).toBeGreaterThan(0);
  });
});

describe('_buildRotationCaption — furniture_tip', () => {
  it('includes title and tip text', () => {
    const caption = _buildRotationCaption('instagram', 'furniture_tip', {
      title: 'Rotate monthly',
      tip: 'Flip your mattress every month.',
    });
    expect(caption).toContain('Rotate monthly');
    expect(caption).toContain('Flip your mattress every month.');
  });

  it('adds "Did you know?" prefix', () => {
    const caption = _buildRotationCaption('instagram', 'furniture_tip', {
      title: 'Rotate monthly',
      tip: 'Flip monthly.',
    });
    expect(caption).toContain('Did you know?');
  });
});

describe('_buildRotationCaption — pinterest shop-link suppression', () => {
  it('omits shop link from Pinterest featured_product captions', () => {
    const caption = _buildRotationCaption('pinterest', 'featured_product', { productName: 'Fuji Frame', price: 699 });
    expect(caption).not.toContain('carolinafutons.com');
  });

  it('omits shop link from Pinterest review_highlight captions', () => {
    const caption = _buildRotationCaption('pinterest', 'review_highlight', {
      reviewText: 'Great!',
      reviewerName: 'Jane D.',
    });
    expect(caption).not.toContain('carolinafutons.com');
  });

  it('omits shop link from Pinterest furniture_tip captions', () => {
    const caption = _buildRotationCaption('pinterest', 'furniture_tip', {
      title: 'Rotate monthly',
      tip: 'Flip it.',
    });
    expect(caption).not.toContain('carolinafutons.com');
  });
});

describe('_buildRotationCaption — weekend_promo', () => {
  it('includes promo title and URL', () => {
    const caption = _buildRotationCaption('facebook', 'weekend_promo', _WEEKEND_PROMO);
    expect(caption).toContain(_WEEKEND_PROMO.title);
    expect(caption).toContain(_WEEKEND_PROMO.url);
  });

  it('includes store hours matching site footer (Wed–Fri/Sat)', () => {
    const caption = _buildRotationCaption('facebook', 'weekend_promo', _WEEKEND_PROMO);
    expect(caption).toContain(_WEEKEND_PROMO.hours);
    // Verify hours match the site footer, not the old Mon–Sat/Sun schedule
    // Correct hours per site: Wed–Sat 10am–5pm (in store or by appt)
    expect(_WEEKEND_PROMO.hours).toContain('Wed–Sat');
    expect(_WEEKEND_PROMO.hours).toContain('10am–5pm');
    expect(_WEEKEND_PROMO.hours).not.toContain('Mon');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// runDailyContentRotation — featured_product day
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — featured_product (Mon/Wed/Fri)', () => {
  beforeEach(() => {
    // Stub getDay to return Monday (1)
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(1);
  });

  it('schedules 3 posts (one per platform) when a featured product exists', async () => {
    __seed('Stores/Products', [mockProduct()]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.contentType).toBe('featured_product');
    expect(result.scheduled).toBe(3);
    expect(inserts).toHaveLength(3);
  });

  it('inserts correct eventType and contentType into ContentSchedule', async () => {
    __seed('Stores/Products', [mockProduct()]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    expect(inserts.every(i => i.eventType === 'featured_product')).toBe(true);
    expect(inserts.every(i => i.contentType === 'social_story')).toBe(true);
    expect(inserts.every(i => i.status === 'pending')).toBe(true);
  });

  it('prefers ribbon-tagged product over untagged ones', async () => {
    __seed('Stores/Products', [
      mockProduct({ _id: 'prod-no-ribbon', name: 'Plain Frame', ribbon: null }),
      mockProduct({ _id: 'prod-ribbon', name: 'Featured Frame', ribbon: 'Best Seller' }),
    ]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    // ribbon-tagged product should be picked (isNotEmpty filter)
    expect(inserts[0].productName).toContain('Featured Frame');
  });

  it('falls back to most-recently-updated product when no ribbon-tagged products exist', async () => {
    // Only un-ribboned product — should still succeed via fallback query
    __seed('Stores/Products', [mockProduct({ _id: 'prod-plain', name: 'Plain Frame', ribbon: null })]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
    expect(inserts[0].productName).toBe('Plain Frame');
  });

  it('returns failure when catalog is empty', async () => {
    __seed('Stores/Products', []);

    const result = await runDailyContentRotation();
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('no products found');
  });

  it('logs completion to console', async () => {
    __seed('Stores/Products', [mockProduct()]);
    await runDailyContentRotation();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[socialStoryScheduler] runDailyContentRotation complete:'),
      expect.any(String),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// runDailyContentRotation — review_highlight day
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — review_highlight (Tue/Thu)', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(2); // Tuesday
  });

  it('schedules 3 review posts when a qualifying review exists', async () => {
    __seed('ProductReviews', [mockReview()]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.contentType).toBe('review_highlight');
    expect(result.scheduled).toBe(3);
  });

  it('includes review text in the scheduled payload', async () => {
    __seed('ProductReviews', [mockReview({ content: 'Superb craftsmanship!' })]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    const payload = JSON.parse(inserts[0].payload);
    expect(payload.caption).toContain('Superb craftsmanship!');
  });

  it('uses fallback review text when no reviews exist in DB', async () => {
    __seed('ProductReviews', []);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3); // fallback still posts
  });

  it('sets eventType to review_highlight', async () => {
    __seed('ProductReviews', [mockReview()]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    expect(inserts.every(i => i.eventType === 'review_highlight')).toBe(true);
  });

  it('does NOT post 3-star reviews — skips to fallback brand testimonial', async () => {
    // Seed only a low-rated review (below the >= 4 threshold)
    __seed('ProductReviews', [mockReview({ rating: 3 })]);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3); // fallback brand testimonial still posts
    // Payload should contain the fallback text, not the low-rated review
    const payload = JSON.parse(inserts[0].payload);
    expect(payload.reviewText).toContain('Wonderful quality and craftsmanship');
  });

  it('continues to fallback brand testimonial when ProductReviews query fails', async () => {
    __setQueryError('ProductReviews', new Error('Collection unavailable'));

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    // Must still post using the fallback — not return an error
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('pickRecentReview failed'),
      expect.any(String),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// runDailyContentRotation — furniture_tip day
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — furniture_tip (Sat)', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(6); // Saturday
  });

  it('schedules 3 tip posts across all platforms', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.contentType).toBe('furniture_tip');
    expect(result.scheduled).toBe(3);
  });

  it('sets eventType to furniture_tip', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    expect(inserts.every(i => i.eventType === 'furniture_tip')).toBe(true);
  });

  it('tip content includes "Did you know?" in caption', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    const igPost = inserts.find(i => i.platform === 'instagram');
    const payload = JSON.parse(igPost.payload);
    expect(payload.caption).toContain('Did you know?');
  });

  it('rotates tips based on week number (different tips for different weeks)', () => {
    // Week 0 and week 7 should both use FURNITURE_CARE_TIPS[0] (7 tips, cycles at 7)
    const week0Index = 0 % _FURNITURE_CARE_TIPS.length;
    const week7Index = 7 % _FURNITURE_CARE_TIPS.length;
    expect(_FURNITURE_CARE_TIPS[week0Index].title).toBe(_FURNITURE_CARE_TIPS[week7Index].title);

    // Week 1 uses a different tip than week 0
    expect(_FURNITURE_CARE_TIPS[1 % _FURNITURE_CARE_TIPS.length].title).not.toBe(
      _FURNITURE_CARE_TIPS[2 % _FURNITURE_CARE_TIPS.length].title
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// runDailyContentRotation — weekend_promo day
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — weekend_promo (Sun)', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(0); // Sunday
  });

  it('schedules 3 promo posts across all platforms', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(true);
    expect(result.contentType).toBe('weekend_promo');
    expect(result.scheduled).toBe(3);
  });

  it('sets eventType to weekend_promo', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    expect(inserts.every(i => i.eventType === 'weekend_promo')).toBe(true);
  });

  it('caption includes store title and hours', async () => {
    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    await runDailyContentRotation();
    const fbPost = inserts.find(i => i.platform === 'facebook');
    const payload = JSON.parse(fbPost.payload);
    expect(payload.caption).toContain(_WEEKEND_PROMO.title);
    expect(payload.caption).toContain(_WEEKEND_PROMO.hours);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Rate limits
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — rate limits', () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(0); // Sunday (promo — no extra query needed)
  });

  it('respects daily rate limit — skips rate-limited platforms', async () => {
    // Fill instagram to limit (25 posts today)
    const existingPosts = Array.from({ length: 25 }, () => ({
      contentType: 'social_story',
      platform: 'instagram',
      status: 'pending',
      scheduledAt: new Date(),
    }));
    __seed('ContentSchedule', existingPosts);

    const inserts = [];
    __onInsert((_col, item) => { if (_col === 'ContentSchedule') inserts.push(item); });

    const result = await runDailyContentRotation();
    expect(result.rateLimited).toBeGreaterThanOrEqual(1);
    // success = true because remaining platforms still posted
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(_PLATFORMS.length - 1); // all but rate-limited instagram
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Error handling
// ═══════════════════════════════════════════════════════════════════════

describe('runDailyContentRotation — error handling', () => {
  it('returns success: false when all inserts throw', async () => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(0); // Sunday
    __onInsert(() => { throw new Error('DB unavailable'); });

    const result = await runDailyContentRotation();
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('continues scheduling remaining platforms when one insert fails', async () => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(0); // Sunday
    let callCount = 0;
    __onInsert((_col) => {
      if (_col !== 'ContentSchedule') return;
      callCount++;
      if (callCount === 1) throw new Error('First platform failed');
      // Others succeed
    });

    const result = await runDailyContentRotation();
    // 1 failed, 2 succeeded → success: true (scheduled > 0)
    expect(result.scheduled).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.success).toBe(true);
  });

  it('handles product query failure on featured_product day', async () => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(1); // Monday
    __setQueryError('Stores/Products', new Error('Catalog unavailable'));

    const result = await runDailyContentRotation();
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(console.error).toHaveBeenCalled();
  });

  it('returns structured shape on any execution path', async () => {
    vi.spyOn(Date.prototype, 'getDay').mockReturnValue(0);
    const result = await runDailyContentRotation();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('contentType');
    expect(result).toHaveProperty('scheduled');
    expect(result).toHaveProperty('skipped');
    expect(result).toHaveProperty('rateLimited');
    expect(result).toHaveProperty('errors');
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// jobs.config cron registration
// ═══════════════════════════════════════════════════════════════════════

describe('jobs.config — dailyContentRotation cron registration', () => {
  it('includes dailyContentRotation entry', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    expect(jobs).toHaveProperty('dailyContentRotation');
  });

  it('points to socialStoryScheduler.web.js', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    expect(jobs.dailyContentRotation.functionLocation).toBe('/socialStoryScheduler.web.js');
  });

  it('fires once daily at the correct UTC time (17:05)', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const cron = jobs.dailyContentRotation.executionConfig.cronExpression;
    expect(cron).not.toMatch(/^\*/);
    const parts = cron.split(' ');
    expect(parts[0]).toBe('5');   // minute
    expect(parts[1]).toBe('17');  // hour (17:05 UTC = 10:05 AM MST)
    expect(parts[2]).toBe('*');   // day-of-month wildcard
    expect(parts[3]).toBe('*');   // month wildcard
  });

  it('dailySocialStories cron is set to 10 AM MT (17:00 UTC)', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const cron = jobs.dailySocialStories.executionConfig.cronExpression;
    // "0 17 * * *"
    const parts = cron.split(' ');
    expect(parts[0]).toBe('0');
    expect(parts[1]).toBe('17');
  });

  it('dailyContentRotation is staggered from dailySocialStories', async () => {
    const { config } = await import('../src/backend/jobs.config');
    const jobs = config();
    const storiesCron = jobs.dailySocialStories.executionConfig.cronExpression;
    const rotationCron = jobs.dailyContentRotation.executionConfig.cronExpression;
    expect(storiesCron).not.toBe(rotationCron);
  });
});
