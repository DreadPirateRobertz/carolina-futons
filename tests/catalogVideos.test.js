/**
 * @file catalogVideos.test.js
 * @description Tests for initCatalogVideos — CMS-driven video wiring on Product Page (CF-7byz).
 * Covers: YouTube video for known slug, MP4 fallback, collapses for unknown slug,
 * allSettled isolation on DB error.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import {
  __reset,
  __seed,
  __setQueryError,
} from './__mocks__/wix-data.js';

// ── $w mock ───────────────────────────────────────────────────────────────────
// Must be set up at module scope — Product Page.js calls $w.onReady at import time.

const elements = new Map();

function makeEl() {
  return {
    text: '',
    src: '',
    accessibility: {},
    expand: vi.fn(),
    collapse: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    getCurrentItem: vi.fn(() => null),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, makeEl());
  return elements.get(sel);
}

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: vi.fn() }
);

// ── Stub heavy page dependencies so the module loads cleanly ──────────────────

vi.mock('public/productCache', () => ({
  getCachedProduct: vi.fn(() => null),
  cacheProduct: vi.fn(),
}));
vi.mock('public/BrowseReminder.js', () => ({
  initBrowseTracking: vi.fn(),
  _createBrowseState: vi.fn(() => ({})),
}));
vi.mock('public/ProductPagePolish.js', () => ({
  applyProductPageTokens: vi.fn(),
}));
vi.mock('public/InventoryDisplay.js', () => ({
  initInventoryDisplay: vi.fn(),
}));
vi.mock('public/PDPSocialProofBadge.js', () => ({
  initPDPSocialProofBadge: vi.fn(),
}));
vi.mock('public/socialProofToast', () => ({
  initProductSocialProof: vi.fn(),
}));
vi.mock('public/flashSaleHelpers', () => ({
  initProductUrgencyBadge: vi.fn(),
}));
vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    await Promise.allSettled(sections.map(s => s.init()));
    return { critical: [] };
  }),
}));
vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getSameCollection: vi.fn().mockResolvedValue([]),
  getCustomersAlsoBought: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/errorMonitoring.web', () => ({
  logError: vi.fn(),
}));
vi.mock('backend/showroomService.web.js', () => ({
  getShowroomCTA: vi.fn().mockResolvedValue(null),
}));
vi.mock('wix-seo-frontend', () => ({
  head: { setMetaTag: vi.fn() },
}));
vi.mock('public/product/productSchema.js', () => ({
  injectProductMeta: vi.fn(),
  injectPinterestMeta: vi.fn(),
}));
vi.mock('public/giftProductBtn.js', () => ({
  initGiftProductButton: vi.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COLLECTION = 'ProductVideos';

const VIDEO_YOUTUBE = {
  _id: 'v-001',
  videoId: 'v-yt-001',
  title: 'Eureka Assembly Guide',
  brand: 'Carolina Futons',
  type: 'assembly',
  youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  mp4Url: null,
  thumbnailUrl: null,
  productSlugs: JSON.stringify(['eureka-futon-frame']),
  duration: 180,
  sortOrder: 1,
};

const VIDEO_MP4_ONLY = {
  _id: 'v-002',
  videoId: 'v-mp4-001',
  title: 'Wall Hugger Demo',
  type: 'demo',
  youtubeUrl: null,
  mp4Url: 'https://cdn.carolinafutons.com/videos/wall-hugger-demo.mp4',
  thumbnailUrl: null,
  productSlugs: JSON.stringify(['wall-hugger-frame']),
  sortOrder: 1,
};

// ── Load module ───────────────────────────────────────────────────────────────

let initCatalogVideos;

beforeAll(async () => {
// ── Auto-added by cf-obz ──────────────────────────────────────────
vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn().mockResolvedValue([]),
}));
vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));
vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn(p => p?.name ?? ''),
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));
vi.mock('public/productCardHelpers.js', () => ({
  renderSimplePrice: vi.fn(),
  setCardImage: vi.fn(),
  styleCardContainer: vi.fn(),
}));
vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 400, height: 400 })),
}));
vi.mock('public/ProductGallery.js', () => ({
  initImageGallery: vi.fn(),
  initProductBadge: vi.fn(),
  initProductVideo: vi.fn(),
}));
vi.mock('public/ProductOptions.js', () => ({
  initVariantSelector: vi.fn().mockResolvedValue(undefined),
  initSwatchSelector: vi.fn(),
}));
vi.mock('public/ProductDetails.js', () => ({
  initBreadcrumbs: vi.fn(),
  initProductInfoAccordion: vi.fn(),
  initSocialShare: vi.fn(),
  initDeliveryEstimate: vi.fn(),
  injectProductSchema: vi.fn(),
  initSwatchRequest: vi.fn(),
  initSwatchCTA: vi.fn(),
}));
vi.mock('public/AddToCart.js', () => ({
  initQuantitySelector: vi.fn(),
  initAddToCartEnhancements: vi.fn(),
  initStickyCartBar: vi.fn(),
  initBundleSection: vi.fn().mockResolvedValue(undefined),
  initStockUrgency: vi.fn(),
  initBackInStockNotification: vi.fn(),
  initWishlistButton: vi.fn(),
  initPriceDropNotify: vi.fn(),
}));
vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
  announce: vi.fn(),
}));
vi.mock('backend/productVideos.web', () => ({
  getProductVideos: vi.fn().mockResolvedValue([]),
}));
vi.mock('public/videoHelpers.js', () => ({
  buildYouTubeEmbed: vi.fn(() => ''),
}));
vi.mock('public/productStructuredData.js', () => ({
  initProductStructuredData: vi.fn().mockResolvedValue(undefined),
}));
// ── End auto-added ─────────────────────────────────────────────────
  const mod = await import('../src/pages/Product Page.js');
  initCatalogVideos = mod.initCatalogVideos;
});

beforeEach(() => {
  elements.clear();
  vi.clearAllMocks();
  __reset();
  __seed(COLLECTION, []);
  // Restore $w.onReady spy after clearAllMocks
  globalThis.$w.onReady = vi.fn();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('initCatalogVideos — YouTube video for known slug', () => {
  it('expands #productVideoContainer when a matching video exists', async () => {
    __seed(COLLECTION, [VIDEO_YOUTUBE]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').expand).toHaveBeenCalledTimes(1);
  });

  it('sets embed src to YouTube iframe HTML containing the video ID', async () => {
    __seed(COLLECTION, [VIDEO_YOUTUBE]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoCatalogEmbed').src).toContain('dQw4w9WgXcQ');
  });

  it('sets title text from the video record', async () => {
    __seed(COLLECTION, [VIDEO_YOUTUBE]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoCatalogTitle').text).toBe('Eureka Assembly Guide');
  });

  it('sets ARIA region label on the container', async () => {
    __seed(COLLECTION, [VIDEO_YOUTUBE]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').accessibility.ariaLabel).toContain('Eureka Assembly Guide');
  });
});

describe('initCatalogVideos — MP4-only video', () => {
  it('sets embed src to mp4Url when no youtubeUrl is present', async () => {
    __seed(COLLECTION, [VIDEO_MP4_ONLY]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'wall-hugger-frame' } });
    expect(getEl('#productVideoCatalogEmbed').src).toBe(VIDEO_MP4_ONLY.mp4Url);
    expect(getEl('#productVideoContainer').expand).toHaveBeenCalledTimes(1);
  });
});

describe('initCatalogVideos — collapses when no video matches', () => {
  it('collapses container when collection is empty', async () => {
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
    expect(getEl('#productVideoContainer').expand).not.toHaveBeenCalled();
  });

  it('collapses container when no video entry matches the slug', async () => {
    __seed(COLLECTION, [{ ...VIDEO_YOUTUBE, productSlugs: JSON.stringify(['other-product']) }]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
  });

  it('collapses container when product has no slug', async () => {
    __seed(COLLECTION, [VIDEO_YOUTUBE]);
    await initCatalogVideos(globalThis.$w, { product: { _id: 'p1' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
    expect(getEl('#productVideoContainer').expand).not.toHaveBeenCalled();
  });

  it('collapses container when product is null', async () => {
    await initCatalogVideos(globalThis.$w, { product: null });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
  });

  it('collapses container when pageState is undefined', async () => {
    await initCatalogVideos(globalThis.$w, undefined);
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
    expect(getEl('#productVideoContainer').expand).not.toHaveBeenCalled();
  });

  it('collapses container when getProductVideos returns success:false (invalid slug)', async () => {
    // Slug '!!!' sanitizes to '' in cleanSlug → backend returns { success: false }
    await initCatalogVideos(globalThis.$w, { product: { slug: '!!!' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
    expect(getEl('#productVideoContainer').expand).not.toHaveBeenCalled();
  });

  it('collapses when matched video has neither youtubeUrl nor mp4Url', async () => {
    __seed(COLLECTION, [{
      ...VIDEO_YOUTUBE,
      youtubeUrl: null,
      mp4Url: null,
      productSlugs: JSON.stringify(['eureka-futon-frame']),
    }]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
  });
});

describe('initCatalogVideos — allSettled isolation', () => {
  it('collapses container on DB error (backend catches the throw, returns success:false)', async () => {
    // getProductVideos catches wix-data errors internally and returns { success: false }
    __setQueryError(COLLECTION, new Error('DB failure'));
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoContainer').collapse).toHaveBeenCalled();
    expect(getEl('#productVideoContainer').expand).not.toHaveBeenCalled();
  });

  it('uses the first entry by sortOrder when multiple videos match', async () => {
    __seed(COLLECTION, [
      { ...VIDEO_YOUTUBE, _id: 'v-hi', title: 'High Priority', sortOrder: 1, productSlugs: JSON.stringify(['eureka-futon-frame']) },
      { ...VIDEO_YOUTUBE, _id: 'v-lo', title: 'Low Priority',  sortOrder: 5, productSlugs: JSON.stringify(['eureka-futon-frame']) },
    ]);
    await initCatalogVideos(globalThis.$w, { product: { slug: 'eureka-futon-frame' } });
    expect(getEl('#productVideoCatalogTitle').text).toBe('High Priority');
  });
});
