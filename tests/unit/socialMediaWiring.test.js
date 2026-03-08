import { describe, it, expect, beforeEach, vi } from 'vitest';
import { __seed, __onInsert, __onUpdate, __reset as resetData } from '../__mocks__/wix-data.js';
import { analyticsRecords } from '../fixtures/products.js';

// ══════════════════════════════════════════════════════════════════════════
// 1. trackSocialShare — backend persistence of social share counts
// ══════════════════════════════════════════════════════════════════════════

import {
  trackSocialShare,
} from '../../src/backend/analyticsHelpers.web.js';

beforeEach(() => {
  resetData();
  __seed('ProductAnalytics', analyticsRecords);
});

describe('trackSocialShare (backend)', () => {
  it('increments shareCount for a tracked product', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-frame-001', 'facebook');

    expect(updated).toBeDefined();
    expect(updated.shareCount).toBeGreaterThanOrEqual(1);
  });

  it('initializes shareCount to 1 when field is missing', async () => {
    __seed('ProductAnalytics', [
      { _id: 'ana-noshare', productId: 'prod-noshare', viewCount: 5 },
    ]);
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-noshare', 'pinterest');

    expect(updated.shareCount).toBe(1);
  });

  it('records the platform in lastSharePlatform', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-frame-001', 'pinterest');

    expect(updated.lastSharePlatform).toBe('pinterest');
  });

  it('does not throw for untracked product', async () => {
    await expect(trackSocialShare('prod-nonexistent', 'facebook')).resolves.not.toThrow();
  });

  it('does not throw on null productId', async () => {
    await expect(trackSocialShare(null, 'facebook')).resolves.not.toThrow();
  });

  it('does not throw on null platform', async () => {
    await expect(trackSocialShare('prod-frame-001', null)).resolves.not.toThrow();
  });

  it('sanitizes platform string', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-frame-001', '<script>evil</script>facebook');

    expect(updated.lastSharePlatform).not.toContain('<script>');
  });

  it('updates the ProductAnalytics collection', async () => {
    let updatedCol;
    __onUpdate((col) => { updatedCol = col; });

    await trackSocialShare('prod-frame-001', 'email');

    expect(updatedCol).toBe('ProductAnalytics');
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 2. injectPinterestMeta — Product Page Pinterest Rich Pin injection
// ══════════════════════════════════════════════════════════════════════════

import {
  getProductPinData,
  getPinterestMetaTags,
} from '../../src/backend/pinterestRichPins.web.js';

describe('Pinterest Rich Pin meta injection (integration)', () => {
  it('generates valid meta tags from product data end-to-end', async () => {
    const pinResult = await getProductPinData({
      name: 'Eureka Futon Frame',
      slug: 'eureka-futon-frame',
      description: 'Solid hardwood futon frame.',
      image: 'https://www.carolinafutons.com/images/eureka.jpg',
      price: 599.99,
      inStock: true,
      brand: 'Night & Day Furniture',
      sku: 'NDF-001',
    });
    expect(pinResult.success).toBe(true);

    const tagResult = await getPinterestMetaTags(pinResult.meta);
    expect(tagResult.success).toBe(true);
    expect(tagResult.tags.length).toBeGreaterThan(5);
    expect(tagResult.tagString).toContain('pinterest-rich-pin');
    expect(tagResult.tagString).toContain('product:price:amount');
    expect(tagResult.tagString).toContain('product:brand');
  });

  it('includes Pinterest-specific tags that generic OG does not', async () => {
    const pinResult = await getProductPinData({
      name: 'Test Frame',
      slug: 'test',
      price: 299,
      inStock: true,
    });

    expect(pinResult.meta['pinterest-rich-pin']).toBe('true');
    expect(pinResult.meta['pinterest:description']).toBeDefined();
    expect(pinResult.meta['product:retailer_item_id']).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 3. initTikTokPixel — TikTok tracking pixel initialization
// ══════════════════════════════════════════════════════════════════════════

import { initTikTokPixel } from '../../src/public/tikTokPixel.js';

describe('initTikTokPixel', () => {
  let originalDocument;
  let originalWindow;

  beforeEach(() => {
    originalDocument = globalThis.document;
    originalWindow = globalThis.window;
    // Mock document with head and createElement
    const mockScript = { src: '', async: false, onload: null };
    globalThis.document = {
      createElement: vi.fn(() => mockScript),
      head: { appendChild: vi.fn() },
      getElementsByTagName: vi.fn(() => [{ parentNode: { insertBefore: vi.fn() } }]),
    };
    globalThis.window = { ttq: undefined };
  });

  afterEach(() => {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  });

  it('does not throw when called', () => {
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('does not throw when document is undefined', () => {
    globalThis.document = undefined;
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('does not throw when window is undefined', () => {
    globalThis.window = undefined;
    expect(() => initTikTokPixel()).not.toThrow();
  });

  it('does not re-initialize if ttq already exists', () => {
    globalThis.window = { ttq: { page: vi.fn() } };
    initTikTokPixel();
    expect(document.createElement).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════
// 4. engagementTracker — social_share events route to backend
//    (integration tested in engagementTracker.test.js — trackSocialShare)
// ══════════════════════════════════════════════════════════════════════════

describe('social_share event flow', () => {
  it('backend trackSocialShare accepts platform parameter', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-frame-001', 'tiktok');
    expect(updated.lastSharePlatform).toBe('tiktok');
  });

  it('backend trackSocialShare increments independently of viewCount', async () => {
    let updated;
    __onUpdate((col, item) => { updated = item; });

    await trackSocialShare('prod-frame-001', 'facebook');
    // viewCount should not change — only shareCount
    expect(updated.viewCount).toBe(150); // original value from fixtures
    expect(updated.shareCount).toBeGreaterThanOrEqual(1);
  });
});
