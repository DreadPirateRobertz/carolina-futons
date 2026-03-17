/**
 * Tests for socialStoryScheduler.web.js — CF-886w
 * Social story automation: scheduled posting pipeline with platform-specific
 * formatting, rate limits, engagement windows, and 7-day product dedup.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { __reset, __seed, __onInsert } from 'wix-data';
import { __setMember, __setRoles } from 'wix-members-backend';

import {
  scheduleNewArrivalStories,
  schedulePriceDropStories,
  scheduleSeasonalPromo,
  getRateLimitStatus,
  getEngagementWindows,
  _PLATFORMS,
  _ENGAGEMENT_WINDOWS,
  _DAILY_RATE_LIMITS,
  _getNextEngagementWindow,
  _buildPlatformContent,
} from '../src/backend/socialStoryScheduler.web.js';

const mockProduct = (overrides = {}) => ({
  _id: 'prod-1',
  name: 'Monterey Futon Frame',
  slug: 'monterey',
  price: 549,
  category: 'futon-frames',
  description: 'Solid hardwood mission-style futon frame.',
  images: ['https://static.wixstatic.com/media/test.jpg'],
  ...overrides,
});

beforeEach(() => {
  __reset();
  __setMember({ _id: 'admin-1' });
  __setRoles([{ title: 'Admin' }]);
});

// ═══════════════════════════════════════════════════════════════════════
// scheduleNewArrivalStories
// ═══════════════════════════════════════════════════════════════════════

describe('scheduleNewArrivalStories', () => {
  it('schedules to all 3 platforms by default', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const result = await scheduleNewArrivalStories(mockProduct());
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
    expect(result.skipped).toBe(0);
    expect(result.rateLimited).toBe(0);
    expect(inserts.length).toBe(3);

    const platforms = inserts.map(i => i.item.platform);
    expect(platforms).toContain('instagram');
    expect(platforms).toContain('facebook');
    expect(platforms).toContain('pinterest');
  });

  it('schedules to specific platforms only', async () => {
    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(1);
  });

  it('ignores invalid platform names', async () => {
    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['tiktok', 'instagram'] });
    expect(result.scheduled).toBe(1);
  });

  it('rejects null product', async () => {
    const result = await scheduleNewArrivalStories(null);
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects product without name', async () => {
    const result = await scheduleNewArrivalStories({ _id: 'p1' });
    expect(result.success).toBe(false);
  });

  it('skips platform with existing schedule within 7 days', async () => {
    __seed('ContentSchedule', [{
      _id: 'cs-1',
      contentType: 'social_story',
      platform: 'instagram',
      productId: 'prod-1',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 86400000), // 1 day ago
    }]);

    const result = await scheduleNewArrivalStories(mockProduct());
    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(2); // facebook + pinterest
  });

  it('allows scheduling after 7-day window expires', async () => {
    __seed('ContentSchedule', [{
      _id: 'cs-1',
      contentType: 'social_story',
      platform: 'instagram',
      productId: 'prod-1',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 8 * 86400000), // 8 days ago
    }]);

    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    expect(result.scheduled).toBe(1);
    expect(result.skipped).toBe(0);
  });

  it('also checks pending items for dedup', async () => {
    __seed('ContentSchedule', [{
      _id: 'cs-1',
      contentType: 'social_story',
      platform: 'instagram',
      productId: 'prod-1',
      status: 'pending',
      scheduledAt: new Date(Date.now() - 86400000),
    }]);

    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
  });

  it('dedup is per-platform — different platforms are independent', async () => {
    __seed('ContentSchedule', [{
      _id: 'cs-1',
      contentType: 'social_story',
      platform: 'instagram',
      productId: 'prod-1',
      status: 'sent',
      scheduledAt: new Date(),
    }]);

    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram', 'facebook'] });
    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(1);
  });

  it('enforces rate limits', async () => {
    // Seed 25 posts for instagram today (at limit)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const igPosts = Array.from({ length: 25 }, (_, i) => ({
      _id: `cs-ig-${i}`,
      contentType: 'social_story',
      platform: 'instagram',
      status: 'pending',
      scheduledAt: today,
    }));
    __seed('ContentSchedule', igPosts);

    const result = await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    expect(result.rateLimited).toBe(1);
    expect(result.scheduled).toBe(0);
    expect(result.errors[0]).toContain('rate limit');
  });

  it('sets correct contentType and eventType', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    expect(inserts[0].item.contentType).toBe('social_story');
    expect(inserts[0].item.eventType).toBe('new_arrival');
    expect(inserts[0].item.status).toBe('pending');
  });

  it('stores platform-specific content in payload', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.format).toBe('story');
    expect(payload.aspectRatio).toBe('9:16');
    expect(payload.width).toBe(1080);
    expect(payload.height).toBe(1920);
    expect(payload.caption).toContain('Monterey Futon Frame');
  });

  it('facebook payload has post format', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['facebook'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.format).toBe('post');
    expect(payload.width).toBe(1200);
    expect(payload.height).toBe(630);
  });

  it('pinterest payload has pin format', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['pinterest'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.format).toBe('pin');
    expect(payload.aspectRatio).toBe('2:3');
    expect(payload.width).toBe(1000);
  });

  it('respects priority option', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'], priority: 1 });
    expect(inserts[0].item.priority).toBe(1);
  });

  it('clamps priority to 1-10 range', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct(), { platforms: ['instagram'], priority: 99 });
    expect(inserts[0].item.priority).toBe(10);
  });

  it('uses product slug as productId fallback', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleNewArrivalStories(mockProduct({ _id: undefined }), { platforms: ['instagram'] });
    expect(inserts[0].item.productId).toBe('monterey');
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await scheduleNewArrivalStories(mockProduct());
    expect(result.success).toBe(false);
  });

  it('requires admin role', async () => {
    __setRoles([{ title: 'Member' }]);
    const result = await scheduleNewArrivalStories(mockProduct());
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// schedulePriceDropStories
// ═══════════════════════════════════════════════════════════════════════

describe('schedulePriceDropStories', () => {
  const priceDropProduct = (overrides = {}) => ({
    ...mockProduct(),
    price: 449,
    previousPrice: 549,
    ...overrides,
  });

  it('schedules price drop to all platforms', async () => {
    const result = await schedulePriceDropStories(priceDropProduct());
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
  });

  it('rejects null product', async () => {
    const result = await schedulePriceDropStories(null);
    expect(result.success).toBe(false);
  });

  it('rejects product without name', async () => {
    const result = await schedulePriceDropStories({ price: 449, previousPrice: 549 });
    expect(result.success).toBe(false);
  });

  it('rejects missing previousPrice', async () => {
    const result = await schedulePriceDropStories(mockProduct());
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('previousPrice');
  });

  it('rejects price increase (not a drop)', async () => {
    const result = await schedulePriceDropStories(priceDropProduct({ price: 600, previousPrice: 549 }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('lower');
  });

  it('rejects equal prices', async () => {
    const result = await schedulePriceDropStories(priceDropProduct({ price: 549, previousPrice: 549 }));
    expect(result.success).toBe(false);
  });

  it('includes savings info in payload', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await schedulePriceDropStories(priceDropProduct(), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.previousPrice).toBe('$549.00');
    expect(payload.savings).toBe('$100.00');
  });

  it('sets eventType to price_drop', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await schedulePriceDropStories(priceDropProduct(), { platforms: ['instagram'] });
    expect(inserts[0].item.eventType).toBe('price_drop');
  });

  it('uses priority 2 by default (higher than new arrivals)', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await schedulePriceDropStories(priceDropProduct(), { platforms: ['instagram'] });
    expect(inserts[0].item.priority).toBe(2);
  });

  it('respects 7-day dedup window', async () => {
    __seed('ContentSchedule', [{
      _id: 'cs-1',
      contentType: 'social_story',
      platform: 'instagram',
      productId: 'prod-1',
      status: 'sent',
      scheduledAt: new Date(),
    }]);

    const result = await schedulePriceDropStories(priceDropProduct(), { platforms: ['instagram'] });
    expect(result.skipped).toBe(1);
    expect(result.scheduled).toBe(0);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await schedulePriceDropStories(priceDropProduct());
    expect(result.success).toBe(false);
  });

  it('caption mentions PRICE DROP for instagram', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await schedulePriceDropStories(priceDropProduct(), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.caption).toContain('PRICE DROP');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// scheduleSeasonalPromo
// ═══════════════════════════════════════════════════════════════════════

describe('scheduleSeasonalPromo', () => {
  const promoParams = (overrides = {}) => ({
    seasonName: 'Spring Sale',
    promoText: 'Free shipping on all orders over $500!',
    promoCode: 'SPRING26',
    featuredProducts: [mockProduct()],
    ...overrides,
  });

  it('schedules to all 3 platforms', async () => {
    const result = await scheduleSeasonalPromo(promoParams());
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
  });

  it('rejects null params', async () => {
    const result = await scheduleSeasonalPromo(null);
    expect(result.success).toBe(false);
  });

  it('rejects missing seasonName', async () => {
    const result = await scheduleSeasonalPromo(promoParams({ seasonName: '' }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('seasonName');
  });

  it('rejects missing promoText', async () => {
    const result = await scheduleSeasonalPromo(promoParams({ promoText: '' }));
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('promoText');
  });

  it('includes promo code in payload caption', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(promoParams(), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.caption).toContain('SPRING26');
  });

  it('includes featured products in caption', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(promoParams(), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.caption).toContain('Monterey Futon Frame');
    expect(payload.caption).toContain('$549.00');
  });

  it('limits featured products to 3', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    const products = Array.from({ length: 5 }, (_, i) => mockProduct({ _id: `p${i}`, name: `Frame ${i}` }));
    await scheduleSeasonalPromo(promoParams({ featuredProducts: products }), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.featuredProducts.length).toBe(3);
  });

  it('works without featured products', async () => {
    const result = await scheduleSeasonalPromo(promoParams({ featuredProducts: [] }));
    expect(result.success).toBe(true);
    expect(result.scheduled).toBe(3);
  });

  it('works without promo code', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(promoParams({ promoCode: undefined }), { platforms: ['instagram'] });
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.caption).not.toContain('Use code');
  });

  it('sets eventType to seasonal_promo', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(promoParams(), { platforms: ['instagram'] });
    expect(inserts[0].item.eventType).toBe('seasonal_promo');
  });

  it('uses priority 1 by default (highest)', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(promoParams(), { platforms: ['instagram'] });
    expect(inserts[0].item.priority).toBe(1);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await scheduleSeasonalPromo(promoParams());
    expect(result.success).toBe(false);
  });

  it('filters out null/nameless featured products', async () => {
    const inserts = [];
    __onInsert((collection, item) => inserts.push({ collection, item }));

    await scheduleSeasonalPromo(
      promoParams({ featuredProducts: [null, { _id: 'x' }, mockProduct()] }),
      { platforms: ['instagram'] },
    );
    const payload = JSON.parse(inserts[0].item.payload);
    expect(payload.featuredProducts.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getRateLimitStatus
// ═══════════════════════════════════════════════════════════════════════

describe('getRateLimitStatus', () => {
  it('returns status for all platforms', async () => {
    const result = await getRateLimitStatus();
    expect(result.success).toBe(true);
    expect(result.platforms.instagram).toBeDefined();
    expect(result.platforms.facebook).toBeDefined();
    expect(result.platforms.pinterest).toBeDefined();
  });

  it('reports correct limits', async () => {
    const result = await getRateLimitStatus();
    expect(result.platforms.instagram.dailyLimit).toBe(25);
    expect(result.platforms.facebook.dailyLimit).toBe(25);
    expect(result.platforms.pinterest.dailyLimit).toBe(50);
  });

  it('counts existing scheduled posts', async () => {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    __seed('ContentSchedule', [
      { _id: 'cs-1', contentType: 'social_story', platform: 'instagram', status: 'pending', scheduledAt: today },
      { _id: 'cs-2', contentType: 'social_story', platform: 'instagram', status: 'sent', scheduledAt: today },
    ]);

    const result = await getRateLimitStatus();
    expect(result.platforms.instagram.postsToday).toBe(2);
    expect(result.platforms.instagram.remaining).toBe(23);
    expect(result.platforms.instagram.withinLimit).toBe(true);
  });

  it('requires admin auth', async () => {
    __setMember(null);
    const result = await getRateLimitStatus();
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getEngagementWindows
// ═══════════════════════════════════════════════════════════════════════

describe('getEngagementWindows', () => {
  it('returns windows for all platforms', async () => {
    const result = await getEngagementWindows();
    expect(result.success).toBe(true);
    expect(result.windows.instagram).toBeDefined();
    expect(result.windows.facebook).toBeDefined();
    expect(result.windows.pinterest).toBeDefined();
  });

  it('reports correct start/end hours', async () => {
    const result = await getEngagementWindows();
    expect(result.windows.instagram.startHour).toBe(11);
    expect(result.windows.instagram.endHour).toBe(13);
    expect(result.windows.pinterest.startHour).toBe(20);
    expect(result.windows.pinterest.endHour).toBe(22);
  });

  it('includes next window as ISO string', async () => {
    const result = await getEngagementWindows();
    expect(result.windows.instagram.nextWindow).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// _getNextEngagementWindow (exported for testing)
// ═══════════════════════════════════════════════════════════════════════

describe('_getNextEngagementWindow', () => {
  it('returns today window start if before window', () => {
    const morning = new Date('2026-04-01T08:00:00');
    const result = _getNextEngagementWindow('instagram', morning);
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(1);
  });

  it('returns current time if within window', () => {
    const during = new Date('2026-04-01T12:00:00');
    const result = _getNextEngagementWindow('instagram', during);
    expect(result.getHours()).toBe(12);
  });

  it('returns tomorrow window start if past window', () => {
    const evening = new Date('2026-04-01T18:00:00');
    const result = _getNextEngagementWindow('instagram', evening);
    expect(result.getHours()).toBe(11);
    expect(result.getDate()).toBe(2);
  });

  it('returns null for unknown platform', () => {
    const result = _getNextEngagementWindow('tiktok', new Date());
    expect(result).toBeNull();
  });

  it('returns null for invalid date', () => {
    const result = _getNextEngagementWindow('instagram', 'not-a-date');
    expect(result).toBeNull();
  });

  it('handles pinterest evening window correctly', () => {
    const afternoon = new Date('2026-04-01T15:00:00');
    const result = _getNextEngagementWindow('pinterest', afternoon);
    expect(result.getHours()).toBe(20);
    expect(result.getDate()).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// _buildPlatformContent (exported for testing)
// ═══════════════════════════════════════════════════════════════════════

describe('_buildPlatformContent', () => {
  it('returns null for null product', () => {
    expect(_buildPlatformContent(null, 'instagram', 'new_arrival')).toBeNull();
  });

  it('returns null for product without name', () => {
    expect(_buildPlatformContent({ _id: 'x' }, 'instagram', 'new_arrival')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(_buildPlatformContent(mockProduct(), 'tiktok', 'new_arrival')).toBeNull();
  });

  it('instagram content has story format', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'new_arrival');
    expect(content.format).toBe('story');
    expect(content.width).toBe(1080);
    expect(content.height).toBe(1920);
    expect(content.aspectRatio).toBe('9:16');
  });

  it('facebook content has post format', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'new_arrival');
    expect(content.format).toBe('post');
    expect(content.width).toBe(1200);
    expect(content.height).toBe(630);
  });

  it('pinterest content has pin format', () => {
    const content = _buildPlatformContent(mockProduct(), 'pinterest', 'new_arrival');
    expect(content.format).toBe('pin');
    expect(content.aspectRatio).toBe('2:3');
  });

  it('includes product info in all formats', () => {
    for (const platform of ['instagram', 'facebook', 'pinterest']) {
      const content = _buildPlatformContent(mockProduct(), platform, 'new_arrival');
      expect(content.productName).toBe('Monterey Futon Frame');
      expect(content.price).toBe('$549.00');
      expect(content.imageUrl).toBe('https://static.wixstatic.com/media/test.jpg');
      expect(content.caption).toBeDefined();
    }
  });

  it('instagram new_arrival caption starts with NEW:', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'new_arrival');
    expect(content.caption).toMatch(/^NEW:/);
  });

  it('instagram price_drop caption starts with PRICE DROP:', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'price_drop');
    expect(content.caption).toMatch(/^PRICE DROP:/);
  });

  it('facebook new_arrival caption starts with Just arrived:', () => {
    const content = _buildPlatformContent(mockProduct(), 'facebook', 'new_arrival');
    expect(content.caption).toMatch(/^Just arrived:/);
  });

  it('instagram caption includes hashtags', () => {
    const content = _buildPlatformContent(mockProduct(), 'instagram', 'new_arrival');
    expect(content.caption).toContain('#CarolinaFutons');
  });

  it('handles product with no price', () => {
    const content = _buildPlatformContent(mockProduct({ price: null }), 'instagram', 'new_arrival');
    expect(content.price).toBe('');
    expect(content.caption).not.toContain('Starting at');
  });

  it('handles product with no images', () => {
    const content = _buildPlatformContent(mockProduct({ images: [] }), 'instagram', 'new_arrival');
    expect(content.imageUrl).toBe('');
  });

  it('handles product with no description', () => {
    const content = _buildPlatformContent(mockProduct({ description: '' }), 'instagram', 'new_arrival');
    expect(content).not.toBeNull();
  });

  it('truncates long descriptions in captions', () => {
    const longDesc = 'A'.repeat(500);
    const content = _buildPlatformContent(mockProduct({ description: longDesc }), 'instagram', 'new_arrival');
    expect(content.caption.length).toBeLessThan(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

describe('module constants', () => {
  it('exports 3 platforms', () => {
    expect(_PLATFORMS).toEqual(['instagram', 'facebook', 'pinterest']);
  });

  it('engagement windows have start < end', () => {
    for (const [platform, w] of Object.entries(_ENGAGEMENT_WINDOWS)) {
      expect(w.start).toBeLessThan(w.end);
    }
  });

  it('rate limits are positive', () => {
    for (const [platform, limit] of Object.entries(_DAILY_RATE_LIMITS)) {
      expect(limit).toBeGreaterThan(0);
    }
  });
});
