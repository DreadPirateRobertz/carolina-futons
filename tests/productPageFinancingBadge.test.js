/**
 * @file productPageFinancingBadge.test.js
 * @description Tests for CF-et8y: Product Page financing badge
 *
 * Covers:
 *  - #financingBadge shown for price >= 200, hidden for price < 200
 *  - #financingMonthly text = 'As low as $<ceil(price/24)>/mo'
 *  - #financingLink href wired to /financing
 *  - #financingBadge hidden when product has no price
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock ──────────────────────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    href: '',
    style: {},
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    onItemClicked: vi.fn(),
    getCurrentItem: vi.fn(() => null),
    getTotalCount: vi.fn(() => 0),
    getItems: vi.fn(() => ({ items: [] })),
    postMessage: vi.fn(),
    scrollTo: vi.fn(),
    setSort: vi.fn(),
    setFilter: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

let onReadyHandler = null;

globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Module Mocks (minimal — only what Product Page imports) ──────────

vi.mock('public/productCache', () => ({
  getCachedProduct: vi.fn(() => null),
  cacheProduct: vi.fn(),
}));

vi.mock('public/InventoryDisplay.js', () => ({
  initInventoryDisplay: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/BrowseReminder.js', () => ({
  initBrowseTracking: vi.fn(),
  showRemindMePopup: vi.fn(),
  _createBrowseState: vi.fn(() => ({ sessionId: '', startTime: Date.now(), productsViewed: [] })),
}));

vi.mock('public/ProductPagePolish.js', () => ({
  styleReviewStars: vi.fn(() => ({ filled: 0, half: false, empty: 5, filledColor: '', emptyColor: '' })),
  styleReviewCard: vi.fn(),
  applyProductPageTokens: vi.fn(),
}));

vi.mock('public/ProductFinancing.js', () => ({
  initFinancingOptions: vi.fn().mockResolvedValue(undefined),
  renderHeroPricingBadge: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getSameCollection: vi.fn().mockResolvedValue([]),
  getBundleSuggestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('wix-seo-frontend', () => ({
  head: {
    setTitle: vi.fn(), setMetaTag: vi.fn(),
    setLinks: vi.fn(), setStructuredData: vi.fn(),
  },
}));

vi.mock('backend/pinterestRichPins.web', () => ({
  getProductPinData: vi.fn(() => ({ success: false, meta: null })),
}));

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn().mockReturnValue('{}'),
  generateAltText: vi.fn().mockResolvedValue(''),
  getBreadcrumbSchema: vi.fn().mockReturnValue('{}'),
  getProductFaqSchema: vi.fn().mockReturnValue('{}'),
  getProductOgTags: vi.fn().mockReturnValue(null),
  getPageTitle: vi.fn().mockReturnValue(''),
  getPageMetaDescription: vi.fn().mockReturnValue(''),
  getCanonicalUrl: vi.fn().mockReturnValue(''),
}));

vi.mock('public/ProductVideoSection.js', () => ({
  initProductVideoSection: vi.fn().mockResolvedValue({ destroy() {} }),
}));

vi.mock('public/Product360Viewer.js', () => ({
  initProduct360Viewer: vi.fn().mockResolvedValue({ destroy() {} }),
}));

vi.mock('public/ProductQA.js', () => ({
  initProductQA: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['', 'eureka-futon-frame'], to: vi.fn() },
  path: ['', 'eureka-futon-frame'],
  to: vi.fn(),
}));

// ── Helpers ─────────────────────────────────────────────────────────

function makeProduct(price) {
  return {
    _id: `prod-${price}`,
    name: 'Test Product',
    price,
    formattedPrice: `$${price}.00`,
    slug: 'eureka-futon-frame',
    mainMedia: 'img.jpg',
    description: 'Test',
    collections: [],
    ribbon: null,
  };
}

async function loadWithProduct(product) {
  elements.clear();
  vi.resetModules();
  // Seed wixData with the product (slug must match location path[1])
  const { __seed, __reset } = await import('wix-data');
  __reset();
  __seed('Stores/Products', [product]);
// ── Auto-added by cf-obz: mock coverage gap reduction ──────────────
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
  styleBadge: vi.fn(),
  initCardHover: vi.fn(),
  formatCardPrice: vi.fn(),
}));
vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    for (const s of sections) { try { await s.init(); } catch (_) {} }
  }),
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
vi.mock('public/socialProofToast', () => ({
  initProductSocialProof: vi.fn(),
  initCategorySocialProof: vi.fn(),
}));
vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn().mockResolvedValue([]),
}));
vi.mock('backend/productVideos.web', () => ({
  getProductVideos: vi.fn().mockResolvedValue([]),
}));
vi.mock('public/flashSaleHelpers', () => ({
  initProductUrgencyBadge: vi.fn(),
  initFlashSaleBanner: vi.fn(),
  initFlashSaleUrgency: vi.fn(),
}));
vi.mock('public/product/productSchema.js', () => ({
  injectProductMeta: vi.fn(),
  injectPinterestMeta: vi.fn(),
  buildGridAlt: vi.fn(p => p?.name ?? ''),
}));
vi.mock('public/giftProductBtn.js', () => ({
  initGiftProductButton: vi.fn(),
}));
vi.mock('public/videoHelpers.js', () => ({
  buildYouTubeEmbed: vi.fn(() => ''),
}));
vi.mock('public/PDPSocialProofBadge.js', () => ({
  initPDPSocialProofBadge: vi.fn(),
}));
vi.mock('public/productStructuredData.js', () => ({
  initProductStructuredData: vi.fn().mockResolvedValue(undefined),
}));
// ── End auto-added mocks ────────────────────────────────────────────
  await import('../src/pages/Product Page.js');
  if (onReadyHandler) await onReadyHandler();
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('Financing Badge (CF-et8y)', () => {
  beforeEach(() => {
    elements.clear();
    vi.resetModules();
  });

  it('shows #financingBadge when price >= 200', async () => {
    await loadWithProduct(makeProduct(499));
    expect(getEl('#financingBadge').show).toHaveBeenCalled();
  });

  it('shows #financingBadge at exactly price = 200 (boundary)', async () => {
    await loadWithProduct(makeProduct(200));
    expect(getEl('#financingBadge').show).toHaveBeenCalled();
  });

  it('hides #financingBadge when price < 200', async () => {
    await loadWithProduct(makeProduct(99));
    expect(getEl('#financingBadge').hide).toHaveBeenCalled();
  });

  it('hides #financingBadge at price = 199 (just below boundary)', async () => {
    await loadWithProduct(makeProduct(199));
    expect(getEl('#financingBadge').hide).toHaveBeenCalled();
  });

  it('sets #financingMonthly text to correct monthly amount', async () => {
    // $499 / 24 = 20.79... → ceil = 21
    await loadWithProduct(makeProduct(499));
    expect(getEl('#financingMonthly').text).toBe('As low as $21/mo');
  });

  it('rounds up monthly amount (ceil not floor)', async () => {
    // $600 / 24 = 25.00 exact → ceil = 25
    await loadWithProduct(makeProduct(600));
    expect(getEl('#financingMonthly').text).toBe('As low as $25/mo');
  });

  it('rounds up fractional monthly amount correctly', async () => {
    // $250 / 24 = 10.416... → ceil = 11
    await loadWithProduct(makeProduct(250));
    expect(getEl('#financingMonthly').text).toBe('As low as $11/mo');
  });

  it('wires #financingLink href to /financing', async () => {
    await loadWithProduct(makeProduct(499));
    expect(getEl('#financingLink').href).toBe('/financing');
  });

  it('does not set monthly text when price < 200', async () => {
    await loadWithProduct(makeProduct(50));
    // Badge hidden — monthly text should not be set
    expect(getEl('#financingMonthly').text).toBe('');
  });

  it('hides #addToCartButton and shows "Product Not Found" when product is null', async () => {
    await loadWithProduct(null);
    // Product Page.js returns early before initFinancingBadge — badge is not touched.
    // The null-product guard ($w('#financingBadge').hide()) inside initFinancingBadge
    // is defensive code for direct calls; the early-return path hides the cart button instead.
    expect(getEl('#addToCartButton').hide).toHaveBeenCalled();
    expect(getEl('#productName').text).toBe('Product Not Found');
  });

  it('hides #financingBadge when product.price is a non-numeric string', async () => {
    await loadWithProduct({ ...makeProduct(0), price: 'free' });
    expect(getEl('#financingBadge').hide).toHaveBeenCalled();
  });
});
