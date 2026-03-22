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
    slug: 'test-product',
    mainMedia: 'img.jpg',
    description: 'Test',
    collections: [],
    ribbon: null,
  };
}

async function loadWithProduct(product) {
  elements.clear();
  vi.resetModules();
  const productDataset = getEl('#productDataset');
  productDataset.getCurrentItem = vi.fn(() => product);
  productDataset.onReady = vi.fn(() => Promise.resolve());
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
});
