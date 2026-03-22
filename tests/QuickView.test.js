/**
 * Tests for QuickView.js
 *
 * Covers: initQuickView (modal setup, ARIA, accessible dialog),
 * openQuickView (product fetch, name/price/image/links, add-to-cart,
 * error/not-found fallbacks), lazy-load cache, and element nicknames.
 *
 * See CF-9btx for original specification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(),
}));

vi.mock('wix-stores-frontend', () => ({
  default: {
    products: {
      getProduct: vi.fn(),
    },
  },
}));

import { initQuickView, openQuickView, __resetCache } from '../src/public/QuickView.js';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { addToCart } from 'public/cartService';
import wixStoresFrontend from 'wix-stores-frontend';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    href: '',
    style: {},
    accessibility: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    focus: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    link: '',
  };
}

function createMock$w() {
  const elements = {};
  const $w = vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
  $w._elements = elements;
  return $w;
}

const PRODUCT = {
  _id: 'prod-001',
  name: 'Sunset Futon Frame',
  price: 299,
  mainMedia: { image: { url: 'https://cdn.example.com/sunset.jpg' } },
  slug: 'sunset-futon-frame',
};

function mockProductSuccess(product = PRODUCT) {
  wixStoresFrontend.products.getProduct.mockResolvedValue(product);
}

function mockProductNotFound() {
  wixStoresFrontend.products.getProduct.mockResolvedValue(null);
}

function mockProductError() {
  wixStoresFrontend.products.getProduct.mockRejectedValue(new Error('Stores API error'));
}

// ── initQuickView — modal setup ────────────────────────────────────────

describe('initQuickView — modal setup', () => {
  let $w, mockDialog;

  beforeEach(() => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
  });

  it('collapses quickViewModal on init', async () => {
    await initQuickView($w);
    expect($w('#quickViewModal').collapse).toHaveBeenCalled();
  });

  it('sets ARIA role dialog on quickViewModal', async () => {
    await initQuickView($w);
    expect($w('#quickViewModal').accessibility.role).toBe('dialog');
  });

  it('sets ariaModal true on quickViewModal', async () => {
    await initQuickView($w);
    expect($w('#quickViewModal').accessibility.ariaModal).toBe(true);
  });

  it('calls setupAccessibleDialog with correct element IDs', async () => {
    await initQuickView($w);
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({
        panelId: '#quickViewModal',
        closeId: '#quickViewClose',
      })
    );
  });

  it('sets ariaLive polite on quickViewAddToCart at init', async () => {
    await initQuickView($w);
    expect($w('#quickViewAddToCart').accessibility.ariaLive).toBe('polite');
  });

  it('announces "Quick view closed" via onClose callback', async () => {
    await initQuickView($w);
    const config = setupAccessibleDialog.mock.calls[0][1];
    config.onClose();
    expect(announce).toHaveBeenCalledWith($w, 'Quick view closed');
  });

  it('returns the dialog object', async () => {
    const result = await initQuickView($w);
    expect(result).toBe(mockDialog);
  });
});

// ── openQuickView — product fetch and render ──────────────────────────

describe('openQuickView — product fetch and render', () => {
  let $w, mockDialog;

  beforeEach(async () => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockProductSuccess();
    await initQuickView($w);
  });

  it('calls getProduct with the given productId', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect(wixStoresFrontend.products.getProduct).toHaveBeenCalledWith('prod-001');
  });

  it('populates quickViewName with product name', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewName').text).toBe('Sunset Futon Frame');
  });

  it('populates quickViewPrice with formatted price', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewPrice').text).toContain('299');
  });

  it('sets quickViewImage src from product mainMedia', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewImage').src).toBe('https://cdn.example.com/sunset.jpg');
  });

  it('sets quickViewFullLink href using product slug', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewFullLink').link).toContain('sunset-futon-frame');
  });

  it('opens the dialog after populating content', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('announces "Quick view opened" on open', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect(announce).toHaveBeenCalledWith($w, 'Quick view opened');
  });

  it('sets ARIA label on quickViewAddToCart button', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewAddToCart').accessibility.ariaLabel).toContain('Sunset Futon Frame');
  });
});

// ── openQuickView — error and not-found paths ─────────────────────────

describe('openQuickView — error and not-found paths', () => {
  let $w, mockDialog;

  beforeEach(async () => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
  });

  async function init() {
    await initQuickView($w);
    vi.clearAllMocks();
    setupAccessibleDialog.mockReturnValue(mockDialog);
  }

  it('shows fallback name when product is not found (null)', async () => {
    mockProductNotFound();
    await init();
    await openQuickView($w, 'prod-missing', mockDialog);
    expect($w('#quickViewName').text).toContain('not available');
  });

  it('shows fallback name when getProduct throws', async () => {
    mockProductError();
    await init();
    await openQuickView($w, 'prod-error', mockDialog);
    expect($w('#quickViewName').text).toContain('not available');
  });

  it('still opens the dialog even when product is not found', async () => {
    mockProductNotFound();
    await init();
    await openQuickView($w, 'prod-missing', mockDialog);
    expect(mockDialog.open).toHaveBeenCalled();
  });

  it('still opens the dialog when getProduct throws', async () => {
    mockProductError();
    await init();
    await openQuickView($w, 'prod-error', mockDialog);
    expect(mockDialog.open).toHaveBeenCalled();
  });
});

// ── openQuickView — lazy-load cache ───────────────────────────────────

describe('openQuickView — lazy-load cache', () => {
  let $w, mockDialog;

  beforeEach(async () => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockProductSuccess();
    await initQuickView($w);
  });

  it('only calls getProduct once for the same productId on repeated opens', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    await openQuickView($w, 'prod-001', mockDialog);
    expect(wixStoresFrontend.products.getProduct).toHaveBeenCalledTimes(1);
  });

  it('calls getProduct again for a different productId', async () => {
    mockProductSuccess(PRODUCT);
    await openQuickView($w, 'prod-001', mockDialog);
    wixStoresFrontend.products.getProduct.mockResolvedValue({ ...PRODUCT, _id: 'prod-002', name: 'Empire Frame' });
    await openQuickView($w, 'prod-002', mockDialog);
    expect(wixStoresFrontend.products.getProduct).toHaveBeenCalledTimes(2);
  });

  it('renders fresh content when productId changes', async () => {
    await openQuickView($w, 'prod-001', mockDialog);
    expect($w('#quickViewName').text).toBe('Sunset Futon Frame');
    wixStoresFrontend.products.getProduct.mockResolvedValue({ ...PRODUCT, _id: 'prod-002', name: 'Empire Frame' });
    await openQuickView($w, 'prod-002', mockDialog);
    expect($w('#quickViewName').text).toBe('Empire Frame');
  });
});

// ── openQuickView — add-to-cart ───────────────────────────────────────

describe('openQuickView — add-to-cart', () => {
  let $w, mockDialog;

  beforeEach(async () => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockProductSuccess();
    await initQuickView($w);
    await openQuickView($w, 'prod-001', mockDialog);
  });

  it('registers onClick on quickViewAddToCart', () => {
    expect($w('#quickViewAddToCart').onClick).toHaveBeenCalled();
  });

  it('calls addToCart with product id when button clicked', async () => {
    const [handler] = $w('#quickViewAddToCart').onClick.mock.calls[0];
    await handler();
    expect(addToCart).toHaveBeenCalledWith('prod-001', 1);
  });

  it('disables button while adding to cart', async () => {
    addToCart.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 10)));
    const [handler] = $w('#quickViewAddToCart').onClick.mock.calls[0];
    const promise = handler();
    expect($w('#quickViewAddToCart').disable).toHaveBeenCalled();
    await promise;
  });

  it('re-enables button after successful add', async () => {
    addToCart.mockResolvedValue({});
    const [handler] = $w('#quickViewAddToCart').onClick.mock.calls[0];
    await handler();
    expect($w('#quickViewAddToCart').enable).toHaveBeenCalled();
  });

  it('re-enables button when addToCart throws', async () => {
    addToCart.mockRejectedValue(new Error('Cart unavailable'));
    const [handler] = $w('#quickViewAddToCart').onClick.mock.calls[0];
    await handler();
    expect($w('#quickViewAddToCart').enable).toHaveBeenCalled();
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs addressed', () => {
  let $w, mockDialog;

  beforeEach(async () => {
    __resetCache();
    vi.clearAllMocks();
    $w = createMock$w();
    mockDialog = { open: vi.fn(), close: vi.fn() };
    setupAccessibleDialog.mockReturnValue(mockDialog);
    mockProductSuccess();
    await initQuickView($w);
    await openQuickView($w, 'prod-001', mockDialog);
  });

  it('addresses #quickViewModal', () => {
    expect($w).toHaveBeenCalledWith('#quickViewModal');
  });

  it('addresses #quickViewClose', () => {
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.closeId).toBe('#quickViewClose');
  });

  it('addresses #quickViewImage', () => {
    expect($w).toHaveBeenCalledWith('#quickViewImage');
  });

  it('addresses #quickViewName', () => {
    expect($w).toHaveBeenCalledWith('#quickViewName');
  });

  it('addresses #quickViewPrice', () => {
    expect($w).toHaveBeenCalledWith('#quickViewPrice');
  });

  it('addresses #quickViewAddToCart', () => {
    expect($w).toHaveBeenCalledWith('#quickViewAddToCart');
  });

  it('addresses #quickViewFullLink', () => {
    expect($w).toHaveBeenCalledWith('#quickViewFullLink');
  });
});
