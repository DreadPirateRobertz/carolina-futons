/**
 * @file productPageSocialProofBadge.test.js
 * Wiring tests: Product Page wires up the social proof badge section (cf-ic1).
 *
 * Verifies that initPDPSocialProofBadge is called with the right arguments
 * when the product page loads, including URL param passthrough.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';
import { __seed as __seedData, __reset as __resetData } from 'wix-data';

// ── $w mock ───────────────────────────────────────────────────────────────────

const elements = new Map();

function createMockEl() {
  return {
    text: '',
    show: vi.fn(),
    hide: vi.fn(),
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    getCurrentItem: vi.fn(() => ({ ...futonFrame, collections: ['futon-frames'] })),
    accessibility: { ariaLabel: '', role: '' },
    data: [],
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockEl());
  return elements.get(sel);
}

let onReadyHandler = null;
globalThis.$w = Object.assign(
  (sel) => getEl(sel),
  { onReady: (fn) => { onReadyHandler = fn; } }
);

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockInitPDPSocialProofBadge = vi.fn().mockResolvedValue(undefined);
const mockGetNeighborCount = vi.fn().mockResolvedValue({ count: 5, zipPrefix: '282', isNational: false });

vi.mock('public/PDPSocialProofBadge.js', () => ({
  initPDPSocialProofBadge: mockInitPDPSocialProofBadge,
}));

vi.mock('backend/socialProofBadge.web', () => ({
  getNeighborCount: mockGetNeighborCount,
}));

// Stub all other imports that Product Page.js uses

vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue([]),
  getSameCollection: vi.fn().mockResolvedValue([]),
  getCustomersAlsoBought: vi.fn().mockResolvedValue({ success: false, products: [] }),
}));
vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn(() => []),
}));
vi.mock('public/productCache', () => ({
  getCachedProduct: vi.fn(() => null),
  cacheProduct: vi.fn(),
}));
vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));
vi.mock('public/productPageUtils.js', () => ({
  buildGridAlt: vi.fn(() => ''),
  isCallForPrice: vi.fn(() => false),
  CALL_FOR_PRICE_TEXT: 'Call for Price',
}));
vi.mock('wix-location-frontend', () => ({
  default: { path: ['product-page', 'eureka-futon-frame'], query: { zipPrefix: '282' } },
  path: ['product-page', 'eureka-futon-frame'],
  query: { zipPrefix: '282' },
}));
vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections) => {
    const results = await Promise.allSettled(sections.map(s => s.init()));
    return { critical: results, deferred: [] };
  }),
}));
vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 300, height: 300 })),
}));
vi.mock('public/ProductGallery.js', () => ({
  initImageGallery: vi.fn(),
  initProductBadge: vi.fn(),
  initProductVideo: vi.fn(),
}));
vi.mock('public/ProductOptions.js', () => ({
  initVariantSelector: vi.fn(),
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
  initBundleSection: vi.fn(),
  initStockUrgency: vi.fn(),
  initBackInStockNotification: vi.fn(),
  initWishlistButton: vi.fn(),
}));
vi.mock('public/BrowseReminder.js', () => ({
  initBrowseTracking: vi.fn(),
  _createBrowseState: vi.fn(() => ({})),
}));
vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
  setupAccessibleDialog: vi.fn(),
}));
vi.mock('public/productCardHelpers.js', () => ({ setCardImage: vi.fn() }));
vi.mock('public/socialProofToast', () => ({ initProductSocialProof: vi.fn().mockResolvedValue(undefined) }));
vi.mock('backend/promotions.web', () => ({ getFlashSales: vi.fn().mockResolvedValue([]) }));
vi.mock('public/flashSaleHelpers', () => ({ initProductUrgencyBadge: vi.fn() }));
vi.mock('public/ProductPagePolish.js', () => ({ applyProductPageTokens: vi.fn() }));
vi.mock('public/InventoryDisplay.js', () => ({ initInventoryDisplay: vi.fn() }));
vi.mock('public/product/productSchema.js', () => ({
  injectProductMeta: vi.fn(),
  injectPinterestMeta: vi.fn(),
}));
vi.mock('public/giftProductBtn.js', () => ({
  initGiftProductButton: vi.fn(),
}));
vi.mock('public/videoHelpers.js', () => ({ buildYouTubeEmbed: vi.fn(() => null) }));

// ── Load Product Page ─────────────────────────────────────────────────────────

beforeAll(async () => {
  await import('../src/pages/Product Page.js');
});

beforeEach(() => {
  vi.clearAllMocks();
  __resetData();
  __seedData('Stores/Products', [{ ...futonFrame, collections: ['futon-frames'] }]);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Product Page — social proof badge wiring', () => {
  it('calls initPDPSocialProofBadge when the page loads', async () => {
    if (!onReadyHandler) throw new Error('Product Page $w.onReady handler was not registered — import failed');
    await onReadyHandler();
    expect(mockInitPDPSocialProofBadge).toHaveBeenCalled();
  });

  it('passes $w, state, and getNeighborCount to initPDPSocialProofBadge', async () => {
    if (!onReadyHandler) throw new Error('Product Page $w.onReady handler was not registered — import failed');
    await onReadyHandler();
    const [_$w, stateArg, fnArg] = mockInitPDPSocialProofBadge.mock.calls[0];
    expect(typeof _$w).toBe('function');
    expect(stateArg).toHaveProperty('product');
    expect(typeof fnArg).toBe('function');
  });

  it('passes zipPrefix from URL query param to initPDPSocialProofBadge', async () => {
    if (!onReadyHandler) throw new Error('Product Page $w.onReady handler was not registered — import failed');
    await onReadyHandler();
    const [, , , opts] = mockInitPDPSocialProofBadge.mock.calls[0];
    expect(opts?.zipPrefix).toBe('282');
  });
});
