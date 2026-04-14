import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { __seed as __seedData, __reset as __resetData } from 'wix-data';

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
// Test product data
// ---------------------------------------------------------------------------
const testProduct = {
  _id: 'prod-123',
  name: 'Test Futon',
  slug: 'test-futon',
  formattedPrice: '$299.00',
  price: '$299.00',
  collections: ['living-room'],
};

const recentProducts = [
  { _id: 'recent-1', name: 'Recent Futon A', slug: 'recent-a', price: '$199.00' },
  { _id: 'recent-2', name: 'Recent Futon B', slug: 'recent-b', price: '$249.00' },
];

const alsoBoughtProducts = [
  { _id: 'also-1', name: 'Also Bought A', slug: 'also-a', formattedPrice: '$349.00', ribbon: 'Best Seller' },
  { _id: 'also-2', name: 'Also Bought B', slug: 'also-b', formattedPrice: '$399.00', ribbon: '' },
];

// ---------------------------------------------------------------------------
// Mock ALL dependencies
// ---------------------------------------------------------------------------
vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn(() => Promise.resolve([])),
  getSameCollection: vi.fn(() => Promise.resolve([])),
  getCustomersAlsoBought: vi.fn(() => Promise.resolve({ success: true, products: [] })),
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
  default: { path: ['product-page', 'test-futon'], to: vi.fn() },
}));

vi.mock('public/performanceHelpers.js', () => ({
  prioritizeSections: vi.fn(async (sections, _opts) => {
    const critical = sections.filter(s => s.critical);
    const deferred = sections.filter(s => !s.critical);
    const results = await Promise.allSettled(critical.map(s => s.init()));
    await Promise.allSettled(deferred.map(s => s.init()));
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
  initPriceDropNotify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('public/BrowseReminder.js', () => ({
  initBrowseTracking: vi.fn(),
  _createBrowseState: vi.fn(() => ({})),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/productCardHelpers.js', async () => {
  const { isCallForPrice, CALL_FOR_PRICE_TEXT } = await import('public/productPageUtils.js');
  return {
    setCardImage: vi.fn(),
    renderSimplePrice: vi.fn(($el, product) => {
      if (!$el) return;
      try {
        if (isCallForPrice(product)) {
          $el.text = CALL_FOR_PRICE_TEXT;
        } else {
          $el.text = product?.formattedDiscountedPrice || product?.formattedPrice || String(product?.price ?? '');
        }
      } catch (e) {}
    }),
  };
});

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

vi.mock('public/cartService.js', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

// ---------------------------------------------------------------------------
// Import mocked modules we need to manipulate in tests
// ---------------------------------------------------------------------------
import { getRecentlyViewed } from 'public/galleryHelpers.js';
import { getCustomersAlsoBought } from 'backend/productRecommendations.web';
import { isCallForPrice } from 'public/productPageUtils.js';
import { setCardImage } from 'public/productCardHelpers.js';
import { makeClickable } from 'public/a11yHelpers.js';
import { getImageDimensions } from 'public/galleryConfig.js';
import { addToCart } from 'public/cartService.js';

// ---------------------------------------------------------------------------
// Import the page (triggers $w.onReady registration)
// ---------------------------------------------------------------------------
// ── Auto-added by cf-obz ──────────────────────────────────────────
vi.mock('backend/productVideos.web', () => ({
  getProductVideos: vi.fn().mockResolvedValue([]),
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
// ── End auto-added ─────────────────────────────────────────────────

beforeAll(async () => {
  await import('../src/pages/Product Page.js');
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Seed wixData with product and run onReady */
async function runWithProduct(product = testProduct) {
  __resetData();
  __seedData('Stores/Products', [product]);
  expect(onReadyHandler).toBeTruthy();
  await onReadyHandler();
  // Allow micro-tasks (deferred sections) to settle
  await new Promise(r => setTimeout(r, 0));
}

/** Build a scoped $item mock for repeater onItemReady callbacks */
function create$item() {
  const itemElements = new Map();
  function $item(sel) {
    if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
    return itemElements.get(sel);
  }
  $item._elements = itemElements;
  return $item;
}

// ---------------------------------------------------------------------------
// Tests — loadRecentlyViewed
// ---------------------------------------------------------------------------
describe('Product Page — loadRecentlyViewed', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses section when getRecentlyViewed returns empty', async () => {
    getRecentlyViewed.mockReturnValue([]);
    await runWithProduct();
    expect(getEl('#recentlyViewedSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when getRecentlyViewed returns null', async () => {
    getRecentlyViewed.mockReturnValue(null);
    await runWithProduct();
    expect(getEl('#recentlyViewedSection').collapse).toHaveBeenCalled();
  });

  it('expands section and sets accessibility when recent products exist', async () => {
    getRecentlyViewed.mockReturnValue(recentProducts);
    await runWithProduct();
    const section = getEl('#recentlyViewedSection');
    expect(section.expand).toHaveBeenCalled();
    expect(section.accessibility.ariaLabel).toBe('Recently viewed products');
    expect(section.accessibility.role).toBe('region');
  });

  it('assigns recent products as repeater data', async () => {
    getRecentlyViewed.mockReturnValue(recentProducts);
    await runWithProduct();
    const repeater = getEl('#recentlyViewedRepeater');
    expect(repeater.data).toEqual(recentProducts);
  });

  it('registers onItemReady on the repeater', async () => {
    getRecentlyViewed.mockReturnValue(recentProducts);
    await runWithProduct();
    const repeater = getEl('#recentlyViewedRepeater');
    expect(repeater.onItemReady).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('onItemReady callback', () => {
    let onItemReadyCb;

    beforeEach(async () => {
      getRecentlyViewed.mockReturnValue(recentProducts);
      await runWithProduct();
      const repeater = getEl('#recentlyViewedRepeater');
      onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
    });

    it('sets card image, name, and price', () => {
      const $item = create$item();
      const itemData = recentProducts[0];
      onItemReadyCb($item, itemData);

      expect(setCardImage).toHaveBeenCalledWith(
        $item('#recentImage'), itemData, '', getImageDimensions('productGridCard')
      );
      expect($item('#recentName').text).toBe('Recent Futon A');
      expect($item('#recentPrice').text).toBe('$199.00');
    });

    it('registers navigation via makeClickable on image and name', () => {
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      expect(makeClickable).toHaveBeenCalledWith(
        $item('#recentImage'), expect.any(Function), { ariaLabel: 'View Recent Futon A' }
      );
      expect(makeClickable).toHaveBeenCalledWith(
        $item('#recentName'), expect.any(Function), { ariaLabel: 'View Recent Futon A details' }
      );
    });

    it('shows "Call for Price" text when isCallForPrice returns true', () => {
      isCallForPrice.mockReturnValue(true);
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      expect($item('#recentPrice').text).toBe('Call for Price');
    });

    it('hides add-to-cart button for call-for-price items', () => {
      isCallForPrice.mockReturnValue(true);
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      expect($item('#recentAddToCart').hide).toHaveBeenCalled();
    });

    it('sets accessibility label on add-to-cart button for normal items', () => {
      isCallForPrice.mockReturnValue(false);
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      expect($item('#recentAddToCart').accessibility.ariaLabel).toBe('Add Recent Futon A to cart');
    });

    it('registers onClick on the add-to-cart button', () => {
      isCallForPrice.mockReturnValue(false);
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      expect($item('#recentAddToCart').onClick).toHaveBeenCalledWith(expect.any(Function));
    });

    it('quick-add-to-cart: disables button, shows Adding..., calls addToCart, shows Added!', async () => {
      isCallForPrice.mockReturnValue(false);
      addToCart.mockResolvedValue();
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      const btn = $item('#recentAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.disable).toHaveBeenCalled();
      // After successful add, label should be 'Added!'
      expect(btn.label).toBe('Added!');
    });

    it('quick-add-to-cart: restores button label after timeout', async () => {
      vi.useFakeTimers();
      isCallForPrice.mockReturnValue(false);
      addToCart.mockResolvedValue();
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      const btn = $item('#recentAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.label).toBe('Added!');
      vi.advanceTimersByTime(2000);
      expect(btn.label).toBe('Add to Cart');
      expect(btn.enable).toHaveBeenCalled();
    });

    it('quick-add-to-cart: restores button on error', async () => {
      isCallForPrice.mockReturnValue(false);
      addToCart.mockRejectedValue(new Error('Cart API failure'));
      const $item = create$item();
      onItemReadyCb($item, recentProducts[0]);

      const btn = $item('#recentAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.label).toBe('Add to Cart');
      expect(btn.enable).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — loadAlsoBought
// ---------------------------------------------------------------------------
describe('Product Page — loadAlsoBought', () => {
  beforeEach(() => {
    elements.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('collapses section when API returns unsuccessful', async () => {
    getCustomersAlsoBought.mockResolvedValue({ success: false });
    await runWithProduct();
    expect(getEl('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when API returns empty products array', async () => {
    getCustomersAlsoBought.mockResolvedValue({ success: true, products: [] });
    await runWithProduct();
    expect(getEl('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when API returns null result', async () => {
    getCustomersAlsoBought.mockResolvedValue(null);
    await runWithProduct();
    expect(getEl('#alsoBoughtSection').collapse).toHaveBeenCalled();
  });

  it('expands section and sets accessibility when products exist', async () => {
    getCustomersAlsoBought.mockResolvedValue({ success: true, products: alsoBoughtProducts });
    await runWithProduct();
    const section = getEl('#alsoBoughtSection');
    expect(section.expand).toHaveBeenCalled();
    expect(section.accessibility.ariaLabel).toBe('Customers also bought');
    expect(section.accessibility.role).toBe('region');
  });

  it('assigns products as repeater data', async () => {
    getCustomersAlsoBought.mockResolvedValue({ success: true, products: alsoBoughtProducts });
    await runWithProduct();
    const repeater = getEl('#alsoBoughtRepeater');
    expect(repeater.data).toEqual(alsoBoughtProducts);
  });

  it('calls getCustomersAlsoBought with product ID and limit 4', async () => {
    getCustomersAlsoBought.mockResolvedValue({ success: true, products: alsoBoughtProducts });
    await runWithProduct();
    expect(getCustomersAlsoBought).toHaveBeenCalledWith('prod-123', 4);
  });

  describe('onItemReady callback', () => {
    let onItemReadyCb;

    beforeEach(async () => {
      getCustomersAlsoBought.mockResolvedValue({ success: true, products: alsoBoughtProducts });
      await runWithProduct();
      const repeater = getEl('#alsoBoughtRepeater');
      onItemReadyCb = repeater.onItemReady.mock.calls[0][0];
    });

    it('sets card image, name, and price', () => {
      const $item = create$item();
      const itemData = alsoBoughtProducts[0];
      onItemReadyCb($item, itemData);

      expect(setCardImage).toHaveBeenCalledWith(
        $item('#alsoBoughtImage'), itemData, '', getImageDimensions('productGridCard')
      );
      expect($item('#alsoBoughtName').text).toBe('Also Bought A');
      expect($item('#alsoBoughtPrice').text).toBe('$349.00');
    });

    it('shows ribbon badge when itemData has ribbon', () => {
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]); // has ribbon: 'Best Seller'

      expect($item('#alsoBoughtBadge').text).toBe('Best Seller');
      expect($item('#alsoBoughtBadge').show).toHaveBeenCalled();
    });

    it('does not show badge when ribbon is empty', () => {
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[1]); // ribbon: ''

      expect($item('#alsoBoughtBadge').show).not.toHaveBeenCalled();
    });

    it('registers navigation via makeClickable on image and name', () => {
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      expect(makeClickable).toHaveBeenCalledWith(
        $item('#alsoBoughtImage'), expect.any(Function), { ariaLabel: 'View Also Bought A' }
      );
      expect(makeClickable).toHaveBeenCalledWith(
        $item('#alsoBoughtName'), expect.any(Function), { ariaLabel: 'View Also Bought A details' }
      );
    });

    it('shows "Call for Price" text when isCallForPrice returns true', () => {
      isCallForPrice.mockReturnValue(true);
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      expect($item('#alsoBoughtPrice').text).toBe('Call for Price');
    });

    it('hides add-to-cart button for call-for-price items', () => {
      isCallForPrice.mockReturnValue(true);
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      expect($item('#alsoBoughtAddToCart').hide).toHaveBeenCalled();
    });

    it('sets accessibility label on add-to-cart button for normal items', () => {
      isCallForPrice.mockReturnValue(false);
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      expect($item('#alsoBoughtAddToCart').accessibility.ariaLabel).toBe('Add Also Bought A to cart');
    });

    it('quick-add-to-cart: disables button, shows Adding..., calls addToCart, shows Added!', async () => {
      isCallForPrice.mockReturnValue(false);
      addToCart.mockResolvedValue();
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      const btn = $item('#alsoBoughtAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.disable).toHaveBeenCalled();
      expect(btn.label).toBe('Added!');
    });

    it('quick-add-to-cart: restores button label after timeout', async () => {
      vi.useFakeTimers();
      isCallForPrice.mockReturnValue(false);
      addToCart.mockResolvedValue();
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      const btn = $item('#alsoBoughtAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.label).toBe('Added!');
      vi.advanceTimersByTime(2000);
      expect(btn.label).toBe('Add to Cart');
      expect(btn.enable).toHaveBeenCalled();
    });

    it('quick-add-to-cart: restores button on error', async () => {
      isCallForPrice.mockReturnValue(false);
      addToCart.mockRejectedValue(new Error('Network error'));
      const $item = create$item();
      onItemReadyCb($item, alsoBoughtProducts[0]);

      const btn = $item('#alsoBoughtAddToCart');
      const clickHandler = btn.onClick.mock.calls[0][0];
      await clickHandler();

      expect(btn.label).toBe('Add to Cart');
      expect(btn.enable).toHaveBeenCalled();
    });
  });
});
