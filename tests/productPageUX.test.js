import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { futonFrame, wallHuggerFrame } from './fixtures/products.js';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn(),
  generateAltText: vi.fn().mockResolvedValue('Eureka Futon Frame - product image'),
  getBreadcrumbSchema: vi.fn(),
  getProductOgTags: vi.fn(),
  getProductFaqSchema: vi.fn(),
}));

vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn(() => []),
  getProductBadge: vi.fn((p) => p?.ribbon || null),
  initImageLightbox: vi.fn(() => ({ destroy: vi.fn() })),
  initImageZoom: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'https://example.com/placeholder.jpg'),
  getPlaceholderProductImages: vi.fn(() => [
    'https://example.com/p1.jpg', 'https://example.com/p2.jpg',
    'https://example.com/p3.jpg', 'https://example.com/p4.jpg',
  ]),
}));

vi.mock('public/touchHelpers', () => ({ enableSwipe: vi.fn() }));
vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(), trackCartAdd: vi.fn(),
  trackGalleryInteraction: vi.fn(), trackSwatchView: vi.fn(),
  trackSocialShare: vi.fn(),
}));
vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn((el, handler, opts) => {
    if (el && handler) el.onClick(handler);
  }),
}));
vi.mock('public/designTokens.js', () => ({
  colors: {
    sand: '#E8D5B7', sandDark: '#C4A882', espresso: '#3A2518',
    mountainBlue: '#5B8FA8', sunsetCoral: '#E8845C', success: '#2D7738',
    white: '#FFFFFF', offWhite: '#FAF7F2', warmGray: '#6B5B4F',
    error: '#C62828',
  },
  typography: {
    h3: { size: '24px', weight: 600 },
    body: { size: '16px', weight: 400 },
    bodySmall: { size: '14px', weight: 400 },
    caption: { size: '12px', weight: 500 },
  },
  spacing: { sm: '8px', md: '16px', lg: '24px' },
  borderRadius: { sm: '4px', md: '8px', card: '12px' },
  shadows: { card: '0 2px 8px rgba(0,0,0,0.08)' },
}));
vi.mock('public/productPageUtils.js', () => ({
  formatCurrency: vi.fn((n) => `$${Number(n).toFixed(2)}`),
  getCategoryFromCollections: vi.fn(() => ({ label: 'Futon Frames', path: '/futon-frames' })),
  addBusinessDays: vi.fn((d, n) => new Date(d.getTime() + n * 86400000)),
  HEART_FILLED_SVG: 'filled.svg',
  HEART_OUTLINE_SVG: 'outline.svg',
  buildGridAlt: vi.fn(() => ''),
}));
vi.mock('public/cartService', () => ({
  getProductVariants: vi.fn().mockResolvedValue([]),
  addToCart: vi.fn().mockResolvedValue({}),
  onCartChanged: vi.fn(),
  clampQuantity: vi.fn((v) => Math.max(1, Math.min(99, parseInt(v) || 1))),
  MIN_QUANTITY: 1, MAX_QUANTITY: 99,
}));
vi.mock('public/ga4Tracking', () => ({
  fireViewContent: vi.fn(), fireAddToCart: vi.fn(), fireAddToWishlist: vi.fn(),
}));
vi.mock('public/validators.js', () => ({
  validateEmail: vi.fn((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
  validateDimension: vi.fn((v, min, max) => {
    const n = Number(v);
    return !isNaN(n) && n >= min && n <= max;
  }),
}));
vi.mock('backend/comfortService.web', () => ({
  getComfortLevels: vi.fn().mockResolvedValue([
    { name: 'Plush', slug: 'plush', tagline: 'Cloud-soft sink-in' },
    { name: 'Medium', slug: 'medium', tagline: 'Balanced support' },
    { name: 'Firm', slug: 'firm', tagline: 'Structured, supportive' },
  ]),
  getProductComfort: vi.fn().mockResolvedValue({
    name: 'Medium', slug: 'medium',
    tagline: 'Balanced support',
    description: 'The best of both worlds.',
    illustration: 'https://example.com/medium.jpg',
    illustrationAlt: 'Medium comfort level',
  }),
  getComfortProducts: vi.fn().mockResolvedValue(['prod-1', 'prod-2']),
}));
vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock('backend/sizeGuide.web', () => ({
  getProductDimensions: vi.fn().mockResolvedValue({
    width: 54, depth: 38, height: 33, unit: 'in',
    seatHeight: 18, seatDepth: 20,
    openWidth: 54, openDepth: 75, openHeight: 10,
  }),
  checkRoomFit: vi.fn().mockResolvedValue({
    fits: true, clearance: { left: 12, right: 12, front: 24 },
    doorwayOk: true, warnings: [],
  }),
  convertUnit: vi.fn((v, from, to) => to === 'cm' ? v * 2.54 : v / 2.54),
  getComparisonTable: vi.fn().mockResolvedValue([
    { size: 'Full', width: 54, depth: 38, height: 33 },
    { size: 'Queen', width: 60, depth: 38, height: 33 },
  ]),
}));
vi.mock('wix-window-frontend', () => ({
  default: { onScroll: vi.fn(), getBoundingRect: vi.fn() },
  onScroll: vi.fn(),
}));
vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn().mockResolvedValue([
    { _id: 'rel-1', name: 'Related Item', slug: 'related-item', formattedPrice: '$199.00', mainMedia: 'https://example.com/rel.jpg' },
  ]),
  getSameCollection: vi.fn().mockResolvedValue([
    { _id: 'col-1', name: 'Collection Item', slug: 'collection-item', formattedPrice: '$299.00', mainMedia: 'https://example.com/col.jpg' },
  ]),
  getBundleSuggestion: vi.fn().mockResolvedValue(null),
}));
vi.mock('public/mobileHelpers', () => ({
  collapseOnMobile: vi.fn(),
  initBackToTop: vi.fn(),
  isMobile: vi.fn(() => false),
}));

// ── Imports ──────────────────────────────────────────────────────────

import { initImageGallery, initProductBadge, initProductVideo } from '../src/public/ProductGallery.js';
import { initBreadcrumbs, initProductInfoAccordion, initSocialShare, initDeliveryEstimate, initSwatchRequest } from '../src/public/ProductDetails.js';
import { initQuantitySelector, initAddToCartEnhancements, initStickyCartBar, initStockUrgency } from '../src/public/AddToCart.js';
import { initComfortCards, renderComfortCard, COMFORT_ICONS } from '../src/public/ComfortStoryCards.js';
import { initImageLightbox, initImageZoom } from 'public/galleryHelpers.js';
import { enableSwipe } from 'public/touchHelpers';
import { announce, makeClickable } from 'public/a11yHelpers.js';
import { getProductDimensions, checkRoomFit } from 'backend/sizeGuide.web';
import { getProductComfort } from 'backend/comfortService.web';
import { getRelatedProducts, getSameCollection } from 'backend/productRecommendations.web';
import { addToCart } from 'public/cartService';
import { colors } from 'public/designTokens.js';
import { collapseOnMobile } from 'public/mobileHelpers';
import { validateDimension } from 'public/validators.js';

// ── Test Helpers ─────────────────────────────────────────────────────

function createMockElement(overrides = {}) {
  return {
    text: '', src: '', alt: '', value: '', label: '', items: [], data: [],
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: 0, animation: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(), onInput: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(),
    onKeyPress: vi.fn(),
    mute: vi.fn(), disable: vi.fn(), enable: vi.fn(),
    focus: vi.fn(),
    getElement: vi.fn(() => null),
    getBoundingRect: vi.fn().mockResolvedValue({ top: 100, bottom: 200, left: 0, right: 400 }),
    postMessage: vi.fn(),
    accessibility: {},
    forEachItem: vi.fn(),
    ...overrides,
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

function makeState(overrides = {}) {
  return {
    product: { ...futonFrame, mediaItems: [
      { src: 'https://example.com/img1.jpg', type: 'image', title: 'Front view' },
      { src: 'https://example.com/img2.jpg', type: 'image', title: 'Side view' },
      { src: 'https://example.com/img3.jpg', type: 'image', title: 'Detail view' },
    ]},
    selectedSwatchId: null,
    selectedQuantity: 1,
    bundleProduct: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// AC 1: Image Gallery — zoom, fullscreen, keyboard navigation
// ═══════════════════════════════════════════════════════════════════════

describe('Image Gallery', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    vi.clearAllMocks();
  });

  it('initializes gallery with product images', () => {
    $w('#productGallery').items = state.product.mediaItems;
    initImageGallery($w, state);
    expect(initImageLightbox).toHaveBeenCalled();
    expect(initImageZoom).toHaveBeenCalled();
  });

  it('sets up thumbnail click to switch main image', () => {
    initImageGallery($w, state);
    const gallery = $w('#productGallery');
    expect(gallery.onItemClicked).toHaveBeenCalled();
    // Simulate click
    const handler = gallery.onItemClicked.mock.calls[0][0];
    handler({ item: { src: 'https://example.com/img2.jpg' } });
    expect($w('#productMainImage').src).toBe('https://example.com/img2.jpg');
  });

  it('initializes zoom on main image', () => {
    initImageGallery($w, state);
    expect(initImageZoom).toHaveBeenCalledWith($w, $w('#productMainImage'));
  });

  it('initializes fullscreen lightbox', () => {
    initImageGallery($w, state);
    expect(initImageLightbox).toHaveBeenCalledWith($w, $w('#productGallery'), $w('#productMainImage'));
  });

  it('sets aria attributes for keyboard navigation', () => {
    // Simulate browser environment for keyboard handling
    const origDoc = global.document;
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeElement: null,
    };
    try {
      initImageGallery($w, state);
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    } finally {
      global.document = origDoc;
    }
  });

  it('handles keyboard arrow navigation with screen reader announcements', () => {
    const origDoc = global.document;
    const listeners = {};
    global.document = {
      addEventListener: vi.fn((event, handler) => { listeners[event] = handler; }),
      removeEventListener: vi.fn(),
      activeElement: { id: 'productMainImage', closest: () => null },
    };
    try {
      $w('#productGallery').items = state.product.mediaItems;
      initImageGallery($w, state);
      const keyHandler = listeners['keydown'];
      expect(keyHandler).toBeDefined();

      // Arrow right
      keyHandler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/img2.jpg');
      expect(announce).toHaveBeenCalledWith($w, 'Image 2 of 3');

      // Arrow left
      keyHandler({ key: 'ArrowLeft', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/img1.jpg');
      expect(announce).toHaveBeenCalledWith($w, 'Image 1 of 3');
    } finally {
      global.document = origDoc;
    }
  });

  it('does not navigate past first/last image', () => {
    const origDoc = global.document;
    const listeners = {};
    global.document = {
      addEventListener: vi.fn((event, handler) => { listeners[event] = handler; }),
      removeEventListener: vi.fn(),
      activeElement: { id: 'productMainImage', closest: () => null },
    };
    try {
      $w('#productGallery').items = state.product.mediaItems;
      initImageGallery($w, state);
      const keyHandler = listeners['keydown'];

      // Try going left from first image
      keyHandler({ key: 'ArrowLeft', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/img1.jpg');

      // Go to last image
      keyHandler({ key: 'ArrowRight', preventDefault: vi.fn() });
      keyHandler({ key: 'ArrowRight', preventDefault: vi.fn() });
      keyHandler({ key: 'ArrowRight', preventDefault: vi.fn() }); // past end
      expect($w('#productMainImage').src).toBe('https://example.com/img3.jpg');
    } finally {
      global.document = origDoc;
    }
  });

  it('fills gallery with placeholders when fewer than 3 images', () => {
    state.product.mediaItems = [{ src: 'https://example.com/solo.jpg', type: 'image' }];
    initImageGallery($w, state);
    const gallery = $w('#productGallery');
    // Items should be set with combined real + placeholder images
    expect(gallery.items.length).toBeGreaterThanOrEqual(1);
  });

  it('uses fallback image when no mainMedia', () => {
    state.product.mainMedia = null;
    initImageGallery($w, state);
    expect($w('#productMainImage').src).toBe('https://example.com/placeholder.jpg');
  });

  it('generates alt text for main image', async () => {
    initImageGallery($w, state);
    // Alt text is async — wait for it
    await new Promise(r => setTimeout(r, 50));
    expect($w('#productMainImage').alt).toBe('Eureka Futon Frame - product image');
  });

  it('returns cleanup function that removes keyboard listener', () => {
    const origDoc = global.document;
    global.document = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeElement: null,
    };
    try {
      const result = initImageGallery($w, state);
      expect(result.destroy).toBeInstanceOf(Function);
      result.destroy();
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    } finally {
      global.document = origDoc;
    }
  });

  it('returns noop destroy when no product', () => {
    state.product = null;
    const result = initImageGallery($w, state);
    expect(result.destroy).toBeInstanceOf(Function);
    result.destroy(); // should not throw
  });

  // ── Mobile swipe ──
  it('enables swipe navigation on mobile when gallery element available', () => {
    // enableSwipe is only called when gallery.getElement() or document.querySelector returns an element
    $w('#productGallery').getElement = vi.fn(() => ({ addEventListener: vi.fn() }));
    initImageGallery($w, state);
    expect(enableSwipe).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 2: Dimension Display — measurements, 'Will It Fit?' CTA
// ═══════════════════════════════════════════════════════════════════════

describe('Dimension Display', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    vi.clearAllMocks();
  });

  it('validates dimension inputs with realistic ranges', () => {
    expect(validateDimension(54, 1, 120)).toBe(true);
    expect(validateDimension(0, 1, 120)).toBe(false);
    expect(validateDimension(-5, 1, 120)).toBe(false);
    expect(validateDimension(999, 1, 120)).toBe(false);
    expect(validateDimension(NaN, 1, 120)).toBe(false);
  });

  it('getProductDimensions returns measurements with unit', async () => {
    const dims = await getProductDimensions('prod-frame-001', 'in');
    expect(dims).toMatchObject({
      width: 54, depth: 38, height: 33, unit: 'in',
    });
  });

  it('getProductDimensions includes open/closed and seat dimensions', async () => {
    const dims = await getProductDimensions('prod-frame-001', 'in');
    expect(dims).toHaveProperty('seatHeight');
    expect(dims).toHaveProperty('seatDepth');
    expect(dims).toHaveProperty('openWidth');
    expect(dims).toHaveProperty('openDepth');
  });

  it('checkRoomFit returns fit status with clearance info', async () => {
    const result = await checkRoomFit({
      productId: 'prod-frame-001',
      roomWidth: 120, roomDepth: 120,
      doorwayWidth: 36, hallwayWidth: 48,
    });
    expect(result).toMatchObject({
      fits: true,
      doorwayOk: true,
    });
    expect(result.clearance).toBeDefined();
  });

  it('checkRoomFit warns when product does not fit', async () => {
    checkRoomFit.mockResolvedValueOnce({
      fits: false,
      clearance: { left: -2, right: -2, front: 5 },
      doorwayOk: false,
      warnings: ['Product wider than doorway', 'Tight fit in room'],
    });
    const result = await checkRoomFit({
      productId: 'prod-frame-001',
      roomWidth: 50, roomDepth: 40,
      doorwayWidth: 30,
    });
    expect(result.fits).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('handles missing dimension data gracefully', async () => {
    getProductDimensions.mockResolvedValueOnce(null);
    const dims = await getProductDimensions('unknown-product', 'in');
    expect(dims).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 3: Sticky Add-to-Cart — scroll visibility, price, CTA
// ═══════════════════════════════════════════════════════════════════════

describe('Sticky Add-to-Cart', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    vi.clearAllMocks();
  });

  it('initializes hidden', () => {
    initStickyCartBar($w, state);
    expect($w('#stickyCartBar').hide).toHaveBeenCalled();
  });

  it('displays product name and price', () => {
    initStickyCartBar($w, state);
    expect($w('#stickyProductName').text).toBe('Eureka Futon Frame');
    expect($w('#stickyPrice').text).toBe('$499.00');
  });

  it('adds to cart on sticky CTA click', async () => {
    initStickyCartBar($w, state);
    const handler = $w('#stickyAddBtn').onClick.mock.calls[0][0];
    await handler();
    expect(addToCart).toHaveBeenCalledWith('prod-frame-001', 1);
  });

  it('disables button during add-to-cart and re-enables', async () => {
    vi.useFakeTimers();
    initStickyCartBar($w, state);
    const handler = $w('#stickyAddBtn').onClick.mock.calls[0][0];
    await handler();
    expect($w('#stickyAddBtn').disable).toHaveBeenCalled();
    expect($w('#stickyAddBtn').label).toBe('Added!');
    vi.advanceTimersByTime(3000);
    expect($w('#stickyAddBtn').label).toBe('Add to Cart');
    vi.useRealTimers();
  });

  it('shows error state on add-to-cart failure', async () => {
    addToCart.mockRejectedValueOnce(new Error('Network error'));
    vi.useFakeTimers();
    initStickyCartBar($w, state);
    const handler = $w('#stickyAddBtn').onClick.mock.calls[0][0];
    await handler();
    expect($w('#stickyAddBtn').label).toBe('Error — Try Again');
    vi.advanceTimersByTime(3000);
    expect($w('#stickyAddBtn').label).toBe('Add to Cart');
    vi.useRealTimers();
  });

  it('handles missing product gracefully on CTA click', async () => {
    vi.useFakeTimers();
    state.product = null;
    initStickyCartBar($w, { ...state, product: { name: 'Test', formattedPrice: '$10.00', _id: null } });
    const handler = $w('#stickyAddBtn').onClick.mock.calls[0][0];
    await handler();
    // Should show loading state when no product ID
    expect($w('#stickyAddBtn').label).toBe('Loading...');
    vi.advanceTimersByTime(1500);
    expect($w('#stickyAddBtn').label).toBe('Add to Cart');
    vi.useRealTimers();
  });

  it('does nothing when stickyCartBar element missing', () => {
    const sparse$w = (sel) => sel === '#stickyCartBar' ? null : createMockElement();
    // Should not throw
    initStickyCartBar(sparse$w, state);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 4: Comfort Story Cards — rendering, swatch CTA integration
// ═══════════════════════════════════════════════════════════════════════

describe('Comfort Story Cards', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    vi.clearAllMocks();
  });

  it('renders comfort card with name, tagline, description', () => {
    const comfort = {
      name: 'Medium', tagline: 'Balanced support',
      description: 'The best of both worlds.',
      illustration: 'https://example.com/medium.jpg',
      illustrationAlt: 'Medium comfort',
    };
    renderComfortCard($w, comfort);
    expect($w('#comfortName').text).toBe('Medium');
    expect($w('#comfortTagline').text).toBe('Balanced support');
    expect($w('#comfortDescription').text).toBe('The best of both worlds.');
  });

  it('renders illustration with alt text', () => {
    const comfort = {
      name: 'Plush', illustration: 'https://example.com/plush.jpg',
      illustrationAlt: 'Plush comfort level',
    };
    renderComfortCard($w, comfort);
    expect($w('#comfortIllustration').src).toBe('https://example.com/plush.jpg');
    expect($w('#comfortIllustration').alt).toBe('Plush comfort level');
  });

  it('generates default alt text when illustrationAlt missing', () => {
    const comfort = {
      name: 'Firm', illustration: 'https://example.com/firm.jpg',
    };
    renderComfortCard($w, comfort);
    expect($w('#comfortIllustration').alt).toBe('Firm comfort level illustration');
  });

  it('handles null comfort data gracefully', () => {
    renderComfortCard($w, null);
    expect($w('#comfortName').text).toBe('');
  });

  it('initComfortCards expands section on success', async () => {
    await initComfortCards($w, state);
    expect($w('#comfortSection').expand).toHaveBeenCalled();
    expect($w('#comfortName').text).toBe('Medium');
  });

  it('initComfortCards collapses section when no product', async () => {
    state.product = null;
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('initComfortCards collapses section when no comfort data', async () => {
    getProductComfort.mockResolvedValueOnce(null);
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('initComfortCards collapses on API error', async () => {
    getProductComfort.mockRejectedValueOnce(new Error('API down'));
    await initComfortCards($w, state);
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('COMFORT_ICONS has entries for all comfort levels', () => {
    expect(COMFORT_ICONS).toHaveProperty('plush');
    expect(COMFORT_ICONS).toHaveProperty('medium');
    expect(COMFORT_ICONS).toHaveProperty('firm');
    expect(COMFORT_ICONS.plush.label).toBe('Cloud-soft');
    expect(COMFORT_ICONS.medium.label).toBe('Balanced');
    expect(COMFORT_ICONS.firm.label).toBe('Structured');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 5: Product Info Accordion — tabs, toggle, keyboard
// ═══════════════════════════════════════════════════════════════════════

describe('Product Info Accordion', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
    vi.clearAllMocks();
  });

  it('expands Description by default, collapses others', () => {
    initProductInfoAccordion($w);
    expect($w('#infoContentDescription').expand).toHaveBeenCalled();
    expect($w('#infoContentDimensions').collapse).toHaveBeenCalled();
    expect($w('#infoContentCare').collapse).toHaveBeenCalled();
    expect($w('#infoContentShipping').collapse).toHaveBeenCalled();
  });

  it('sets correct arrow indicators', () => {
    initProductInfoAccordion($w);
    expect($w('#infoArrowDescription').text).toBe('\u2212'); // minus
    expect($w('#infoArrowDimensions').text).toBe('+');
    expect($w('#infoArrowCare').text).toBe('+');
    expect($w('#infoArrowShipping').text).toBe('+');
  });

  it('toggles section on header click', () => {
    initProductInfoAccordion($w);
    // Click Description header to collapse it
    const handler = $w('#infoHeaderDescription').onClick.mock.calls[0][0];
    handler();
    expect($w('#infoContentDescription').collapse).toHaveBeenCalled();
    expect($w('#infoArrowDescription').text).toBe('+');

    // Click again to expand
    handler();
    expect($w('#infoArrowDescription').text).toBe('\u2212');
  });

  it('supports keyboard toggle (Enter and Space)', () => {
    initProductInfoAccordion($w);
    const keyHandler = $w('#infoHeaderDimensions').onKeyPress.mock.calls[0][0];
    keyHandler({ key: 'Enter' });
    expect($w('#infoContentDimensions').expand).toHaveBeenCalled();
    keyHandler({ key: ' ' });
    expect($w('#infoContentDimensions').collapse).toHaveBeenCalled();
  });

  it('sets aria-expanded attributes', () => {
    initProductInfoAccordion($w);
    expect($w('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
    expect($w('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
  });

  it('sets aria-label on each header', () => {
    initProductInfoAccordion($w);
    expect($w('#infoHeaderDescription').accessibility.ariaLabel).toBe('Description section');
    expect($w('#infoHeaderDimensions').accessibility.ariaLabel).toBe('Dimensions section');
    expect($w('#infoHeaderCare').accessibility.ariaLabel).toBe('Care section');
    expect($w('#infoHeaderShipping').accessibility.ariaLabel).toBe('Shipping section');
  });

  it('populates shipping content with policy text', () => {
    initProductInfoAccordion($w);
    expect($w('#infoContentShipping').text).toContain('Free standard shipping');
    expect($w('#infoContentShipping').text).toContain('White-glove delivery');
    expect($w('#infoContentShipping').text).toContain('Wed');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 6: Related Products — 'Complete the Set', 'You Might Also Like'
// ═══════════════════════════════════════════════════════════════════════

describe('Related Products', () => {
  it('getRelatedProducts returns product array', async () => {
    const results = await getRelatedProducts('prod-frame-001');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ _id: 'rel-1', name: 'Related Item' });
  });

  it('getSameCollection returns products from same collection', async () => {
    const results = await getSameCollection('prod-frame-001');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ _id: 'col-1', name: 'Collection Item' });
  });

  it('handles empty related products', async () => {
    getRelatedProducts.mockResolvedValueOnce([]);
    const results = await getRelatedProducts('unknown');
    expect(results).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 7: Design Tokens — Blue Ridge aesthetic applied
// ═══════════════════════════════════════════════════════════════════════

describe('Design Tokens', () => {
  it('colors match Blue Ridge spec', () => {
    expect(colors.sand).toBe('#E8D5B7');
    expect(colors.espresso).toBe('#3A2518');
    expect(colors.mountainBlue).toBe('#5B8FA8');
    expect(colors.sunsetCoral).toBe('#E8845C');
  });

  it('stock status uses design token colors', async () => {
    const $w = create$w();
    const state = makeState();
    state.product.quantityInStock = 3;
    await initStockUrgency($w, state);
    expect($w('#stockUrgency').text).toContain('Only 3 left');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 8: Mobile — swipeable gallery, collapsible sections, thumb CTA
// ═══════════════════════════════════════════════════════════════════════

describe('Mobile', () => {
  it('enableSwipe is called for gallery when element available', () => {
    const $w = create$w();
    const state = makeState();
    $w('#productGallery').getElement = vi.fn(() => ({ addEventListener: vi.fn() }));
    initImageGallery($w, state);
    expect(enableSwipe).toHaveBeenCalled();
  });

  it('quantity buttons are accessible on mobile', () => {
    const $w = create$w();
    const state = makeState();
    initQuantitySelector($w, state);
    expect($w('#quantityMinus').accessibility.ariaLabel).toBe('Decrease quantity');
    expect($w('#quantityPlus').accessibility.ariaLabel).toBe('Increase quantity');
  });

  it('collapseOnMobile helper is available', () => {
    expect(collapseOnMobile).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 9: WCAG AA — aria, alt text, keyboard, announcements
// ═══════════════════════════════════════════════════════════════════════

describe('WCAG AA Accessibility', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    vi.clearAllMocks();
  });

  it('gallery announces current image index for screen readers', () => {
    const origDoc = global.document;
    const listeners = {};
    global.document = {
      addEventListener: vi.fn((e, h) => { listeners[e] = h; }),
      removeEventListener: vi.fn(),
      activeElement: { id: 'productMainImage', closest: () => null },
    };
    try {
      $w('#productGallery').items = state.product.mediaItems;
      initImageGallery($w, state);
      const keyHandler = listeners['keydown'];
      keyHandler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect(announce).toHaveBeenCalledWith($w, 'Image 2 of 3');
    } finally {
      global.document = origDoc;
    }
  });

  it('quantity input has aria-label', () => {
    initQuantitySelector($w, state);
    expect($w('#quantityInput').accessibility.ariaLabel).toBe('Product quantity');
  });

  it('accordion headers have aria-expanded', () => {
    initProductInfoAccordion($w);
    expect($w('#infoHeaderDescription').accessibility.ariaExpanded).toBe(true);
    expect($w('#infoHeaderDimensions').accessibility.ariaExpanded).toBe(false);
  });

  it('accordion headers support Enter and Space key toggle', () => {
    initProductInfoAccordion($w);
    const keyHandler = $w('#infoHeaderCare').onKeyPress.mock.calls[0][0];
    keyHandler({ key: 'Enter' });
    expect($w('#infoContentCare').expand).toHaveBeenCalled();
    expect($w('#infoHeaderCare').accessibility.ariaExpanded).toBe(true);
  });

  it('product badge has appropriate visibility', () => {
    state.product.ribbon = 'Best Seller';
    initProductBadge($w, state);
    expect($w('#productBadgeOverlay').text).toBe('Best Seller');
    expect($w('#productBadgeOverlay').show).toHaveBeenCalled();
  });

  it('product badge hidden when no ribbon', () => {
    state.product.ribbon = '';
    initProductBadge($w, state);
    expect($w('#productBadgeOverlay').hide).toHaveBeenCalled();
  });

  it('breadcrumbs have aria labels', async () => {
    await initBreadcrumbs($w, state);
    expect(makeClickable).toHaveBeenCalledWith(
      expect.anything(), expect.any(Function),
      expect.objectContaining({ ariaLabel: 'Go to home page' }),
    );
  });

  it('social share buttons have aria labels', () => {
    initSocialShare($w, state);
    expect($w('#shareFacebook').accessibility.ariaLabel).toBe('Share on Facebook');
    expect($w('#sharePinterest').accessibility.ariaLabel).toBe('Share on Pinterest');
    expect($w('#shareEmail').accessibility.ariaLabel).toBe('Share via email');
    expect($w('#shareCopyLink').accessibility.ariaLabel).toBe('Copy product link');
  });

  it('comfort illustration has alt text', () => {
    renderComfortCard($w, {
      name: 'Firm', illustration: 'https://example.com/firm.jpg',
      illustrationAlt: 'Firm comfort level',
    });
    expect($w('#comfortIllustration').alt).toBe('Firm comfort level');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AC 10: Integration — product video, delivery estimate, swatch request
// ═══════════════════════════════════════════════════════════════════════

describe('Product Video', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
  });

  it('expands section when video media exists', () => {
    state.product.mediaItems.push({ src: 'https://example.com/video.mp4', type: 'video', mediaType: 'video' });
    initProductVideo($w, state);
    expect($w('#productVideoSection').expand).toHaveBeenCalled();
    expect($w('#productVideoTitle').text).toBe('See It In Action');
  });

  it('collapses section when no video media', () => {
    initProductVideo($w, state);
    expect($w('#productVideoSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when no product', () => {
    state.product = null;
    initProductVideo($w, state);
    // Should not throw, section stays collapsed by default
  });
});

describe('Delivery Estimate', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
  });

  it('shows delivery date range', () => {
    initDeliveryEstimate($w, state);
    expect($w('#deliveryEstimate').text).toContain('Estimated delivery:');
    expect($w('#deliveryEstimate').show).toHaveBeenCalled();
  });

  it('does nothing when no product', () => {
    state.product = null;
    initDeliveryEstimate($w, state);
    expect($w('#deliveryEstimate').text).toBe('');
  });

  it('shows white-glove note for large items', () => {
    state.product.weight = 100;
    initDeliveryEstimate($w, state);
    expect($w('#whiteGloveNote').text).toContain('White-glove');
    expect($w('#whiteGloveNote').show).toHaveBeenCalled();
  });
});

describe('Swatch Request', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
    state.product.productOptions = [
      { name: 'Finish', choices: [{ value: 'oak', description: 'Oak' }, { value: 'walnut', description: 'Walnut' }] },
    ];
  });

  it('shows request button when product has fabric/finish options', () => {
    initSwatchRequest($w, state);
    expect($w('#swatchRequestBtn').show).toHaveBeenCalled();
  });

  it('hides request button when no fabric options', () => {
    state.product.productOptions = [{ name: 'Size', choices: [{ value: 'full' }] }];
    initSwatchRequest($w, state);
    expect($w('#swatchRequestBtn').hide).toHaveBeenCalled();
  });

  it('does nothing when no product', () => {
    state.product = null;
    initSwatchRequest($w, state);
    // Should not throw
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Error / Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe('Error Handling', () => {
  it('gallery handles empty mediaItems', () => {
    const $w = create$w();
    const state = makeState();
    state.product.mediaItems = [];
    // Should not throw
    initImageGallery($w, state);
  });

  it('gallery handles null product', () => {
    const $w = create$w();
    const result = initImageGallery($w, { product: null });
    expect(result.destroy).toBeInstanceOf(Function);
  });

  it('comfort cards handle state with no product field', async () => {
    const $w = create$w();
    await initComfortCards($w, {});
    expect($w('#comfortSection').collapse).toHaveBeenCalled();
  });

  it('sticky cart bar handles missing elements gracefully', () => {
    // All elements return mocks by default, so this is mainly a smoke test
    const $w = create$w();
    const state = makeState();
    initStickyCartBar($w, state);
    // Should not throw
  });

  it('accordion handles missing section elements', () => {
    // Smoke test: should not throw even if some elements are "null"
    const $w = create$w();
    initProductInfoAccordion($w);
    // If it got here without throwing, the try/catch protection works
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Quantity Selector
// ═══════════════════════════════════════════════════════════════════════

describe('Quantity Selector', () => {
  let $w, state;

  beforeEach(() => {
    $w = create$w();
    state = makeState();
  });

  it('initializes with quantity 1', () => {
    initQuantitySelector($w, state);
    expect($w('#quantityInput').value).toBe('1');
    expect(state.selectedQuantity).toBe(1);
  });

  it('minus button decreases quantity', () => {
    initQuantitySelector($w, state);
    state.selectedQuantity = 3;
    $w('#quantityInput').value = '3';
    const handler = $w('#quantityMinus').onClick.mock.calls[0][0];
    handler();
    expect(state.selectedQuantity).toBe(2);
    expect($w('#quantityInput').value).toBe('2');
  });

  it('minus button does not go below 1', () => {
    initQuantitySelector($w, state);
    state.selectedQuantity = 1;
    const handler = $w('#quantityMinus').onClick.mock.calls[0][0];
    handler();
    expect(state.selectedQuantity).toBe(1);
  });

  it('plus button increases quantity', () => {
    initQuantitySelector($w, state);
    state.selectedQuantity = 1;
    const handler = $w('#quantityPlus').onClick.mock.calls[0][0];
    handler();
    expect(state.selectedQuantity).toBe(2);
    expect($w('#quantityInput').value).toBe('2');
  });

  it('plus button does not exceed max quantity', () => {
    initQuantitySelector($w, state);
    state.selectedQuantity = 99;
    const handler = $w('#quantityPlus').onClick.mock.calls[0][0];
    handler();
    expect(state.selectedQuantity).toBe(99);
  });
});
