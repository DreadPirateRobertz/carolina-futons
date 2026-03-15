import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock $w (Wix Velo selector engine)
// ---------------------------------------------------------------------------
const elements = new Map();
function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    options: [], data: [],
    style: { color: '', fontWeight: '', backgroundColor: '' },
    accessibility: {},
    hidden: false, collapsed: false,
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(function () { this.collapsed = true; }),
    expand: vi.fn(function () { this.collapsed = false; }),
    scrollTo: vi.fn(), postMessage: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    onReady: vi.fn(() => Promise.resolve()),
    focus: vi.fn(), disable: vi.fn(), enable: vi.fn(),
    getCurrentItem: vi.fn(() => null),
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

// ---------------------------------------------------------------------------
// Mock ALL dependencies
// ---------------------------------------------------------------------------
vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn(() => Promise.resolve([])),
  getSameCollection: vi.fn(() => Promise.resolve([])),
  getCustomersAlsoBought: vi.fn(() => Promise.resolve({ success: false })),
}));

vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn(() => []),
}));

vi.mock('public/productCache', () => ({
  cacheProduct: vi.fn(),
  getCachedProduct: vi.fn(() => null),
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
  default: { path: ['product-page', 'test-product'], to: vi.fn() },
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections, _opts) => {
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    const results = await Promise.allSettled(critical.map(s => s.init()));
    Promise.allSettled(deferred.map(s => s.init())).catch(() => {});
    return { critical: results };
  }),
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({})),
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
}));

vi.mock('public/productCardHelpers.js', () => ({
  setCardImage: vi.fn(),
}));

vi.mock('public/socialProofToast', () => ({
  initProductSocialProof: vi.fn(() => Promise.resolve()),
}));

vi.mock('backend/promotions.web', () => ({
  getFlashSales: vi.fn(() => Promise.resolve([])),
}));

vi.mock('public/flashSaleHelpers', () => ({
  initProductUrgencyBadge: vi.fn(),
}));

vi.mock('public/ProductPagePolish.js', () => ({
  applyProductPageTokens: vi.fn(),
}));

vi.mock('public/InventoryDisplay.js', () => ({
  initInventoryDisplay: vi.fn(),
}));

vi.mock('public/product/productSchema.js', () => ({
  injectProductMeta: vi.fn(),
  injectPinterestMeta: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Import the page (triggers $w.onReady registration)
// ---------------------------------------------------------------------------
import { trackProductView } from 'public/galleryHelpers.js';
import { cacheProduct } from 'public/productCache';
import { prioritizeSections } from 'public/performanceHelpers.js';

beforeAll(async () => {
  await import('../src/pages/Product Page.js');
});

// ---------------------------------------------------------------------------
// Tests — "product not found" path (getCurrentItem returns null)
// ---------------------------------------------------------------------------
describe('Product Page — product not found', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
    // Ensure dataset.getCurrentItem returns null (default from createMockElement)
  });

  async function runOnReady() {
    expect(onReadyHandler).toBeTruthy();
    await onReadyHandler();
  }

  it('does not throw when product is null', async () => {
    await expect(runOnReady()).resolves.toBeUndefined();
  });

  it('sets #productName text to "Product Not Found"', async () => {
    await runOnReady();
    expect(getEl('#productName').text).toBe('Product Not Found');
  });

  it('sets #productPrice text to empty string', async () => {
    await runOnReady();
    expect(getEl('#productPrice').text).toBe('');
  });

  it('sets #productDescription to "no longer available" message', async () => {
    await runOnReady();
    expect(getEl('#productDescription').text).toContain('no longer available');
  });

  it('calls #addToCartButton.hide()', async () => {
    await runOnReady();
    expect(getEl('#addToCartButton').hide).toHaveBeenCalled();
  });

  it('does NOT call trackProductView', async () => {
    await runOnReady();
    expect(trackProductView).not.toHaveBeenCalled();
  });

  it('does NOT call prioritizeSections (returns early)', async () => {
    await runOnReady();
    expect(prioritizeSections).not.toHaveBeenCalled();
  });

  it('does NOT call cacheProduct', async () => {
    await runOnReady();
    expect(cacheProduct).not.toHaveBeenCalled();
  });

  it('waits for #productDataset.onReady() before checking item', async () => {
    await runOnReady();
    expect(getEl('#productDataset').onReady).toHaveBeenCalled();
    expect(getEl('#productDataset').getCurrentItem).toHaveBeenCalled();
  });

  it('sets full description text with catalog browsing suggestion', async () => {
    await runOnReady();
    expect(getEl('#productDescription').text).toBe(
      'Sorry, this product is no longer available. Please browse our catalog for similar items.'
    );
  });
});
