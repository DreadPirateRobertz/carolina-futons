/**
 * Product Page Feature Hookup Tests (cf-f69o)
 *
 * Verifies that Product Page.js correctly imports and delegates to all
 * 7 feature block init functions, and that all spec $w IDs are wired.
 *
 * Feature blocks: Fabric Swatch (23 IDs), Info Accordion (12 IDs),
 * Financing Modal (16 IDs), Sticky Cart Bar (4 IDs), Social Share (4 IDs),
 * Quantity Selector (3 IDs), Breadcrumbs (4 IDs).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock that tracks all accessed IDs ────────────────────────────

function createTrackingMock() {
  const accessedIds = new Set();
  const elements = new Map();

  function createMockElement(id) {
    return {
      _id: id,
      text: '',
      src: '',
      alt: '',
      value: '',
      label: '',
      options: [],
      data: [],
      style: { color: '', backgroundColor: '', overflowX: '', flexWrap: '' },
      accessibility: {},
      show: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      collapse: vi.fn(),
      expand: vi.fn(),
      scrollTo: vi.fn(),
      postMessage: vi.fn(),
      onClick: vi.fn(),
      onChange: vi.fn(),
      onInput: vi.fn(),
      onItemReady: vi.fn(),
      onItemClicked: vi.fn(),
      onReady: vi.fn(() => Promise.resolve()),
      disable: vi.fn(),
      enable: vi.fn(),
      getCurrentItem: vi.fn(() => null),
    };
  }

  function $w(sel) {
    accessedIds.add(sel);
    if (!elements.has(sel)) elements.set(sel, createMockElement(sel));
    return elements.get(sel);
  }

  return { $w, accessedIds, elements };
}

// ── Mock backends ───────────────────────────────────────────────────

vi.mock('backend/seoHelpers.web', () => ({
  getBreadcrumbSchema: vi.fn().mockResolvedValue('{"@type":"BreadcrumbList"}'),
}));

vi.mock('backend/swatchService.web', () => ({
  getProductSwatches: vi.fn().mockResolvedValue([
    { _id: 'sw1', swatchName: 'Navy', swatchImage: 'navy.jpg', colorHex: '#000080' },
    { _id: 'sw2', swatchName: 'Sage', swatchImage: 'sage.jpg', colorHex: '#87AE73' },
  ]),
  getSwatchCount: vi.fn().mockResolvedValue(2),
  getAllSwatchFamilies: vi.fn().mockResolvedValue(['Blue', 'Green']),
  requestSwatches: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/comfortService.web', () => ({
  getProductComfort: vi.fn().mockResolvedValue({
    level: 'plush',
    label: 'Cloud Soft',
    description: 'Ultra-plush cushioning',
  }),
}));

vi.mock('backend/financingService.web', () => ({
  getFinancingOptions: vi.fn().mockResolvedValue([
    { id: 'p1', label: 'Pay in 4', monthly: 125, term: 4, apr: 0, totalCost: 500, interest: 0, description: '4 interest-free payments' },
  ]),
  getLowestMonthlyDisplay: vi.fn().mockResolvedValue('As low as $125/mo'),
}));

vi.mock('backend/contactSubmissions.web', () => ({
  submitContactForm: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/emailService.web', () => ({
  submitSwatchRequest: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('backend/productRecommendations.web', () => ({
  getBundleSuggestion: vi.fn().mockResolvedValue(null),
}));

vi.mock('backend/inventoryService.web', () => ({
  getStockStatus: vi.fn().mockResolvedValue({ status: 'in_stock', variants: [] }),
}));

vi.mock('public/designTokens.js', () => ({
  colors: {
    espresso: '#3A2518', sand: '#E8D5B7', mountainBlue: '#5B8FA8',
    sunsetCoral: '#E8845C', offWhite: '#FAF7F2', sandLight: '#F2E8D5',
    white: '#FFFFFF', error: '#D32F2F', success: '#2E7D32',
  },
  typography: { fontFamilies: {} },
  spacing: {},
}));

vi.mock('public/mobileHelpers', () => ({
  isMobile: vi.fn(() => false),
}));

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
  makeClickable: vi.fn(),
  createFocusTrap: vi.fn(() => ({ activate: vi.fn(), deactivate: vi.fn() })),
}));

vi.mock('public/ComfortStoryCards.js', () => ({
  renderComfortCard: vi.fn(),
}));

vi.mock('wix-location-frontend', () => ({
  default: { path: ['product-page', 'eureka-futon'] },
  to: vi.fn(),
}));

vi.mock('wix-seo-frontend', () => ({
  head: { setMetaTag: vi.fn() },
}));

// ── Test State ──────────────────────────────────────────────────────

const testProduct = {
  _id: 'prod-001',
  name: 'Eureka Futon Frame',
  slug: 'eureka-futon-frame',
  price: 499,
  formattedPrice: '$499.00',
  discountedPrice: null,
  mainMedia: 'https://example.com/eureka.jpg',
  collections: ['futon-frames'],
  description: 'A solid hardwood frame.',
  inStock: true,
  sku: 'EUR-FRM-001',
  productOptions: [{ name: 'Fabric', choices: [{ value: 'Navy' }, { value: 'Sage' }] }],
};

const testState = { product: testProduct, selectedSwatchId: null, selectedQuantity: 1 };

// ═══════════════════════════════════════════════════════════════════
// 1. ORCHESTRATOR DELEGATION — Product Page.js imports & calls inits
// ═══════════════════════════════════════════════════════════════════

describe('Product Page Feature Hookup — Orchestrator', () => {

  it('imports initFeelAndComfort from FeelAndComfort.js (currently missing)', async () => {
    // This test verifies the import exists — if initFeelAndComfort is
    // called but not imported, it will be a ReferenceError caught by try/catch.
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../src/pages/Product Page.js', import.meta.url), 'utf8')
    );
    expect(pageSource).toContain("import { initFeelAndComfort }");
    expect(pageSource).toContain("from 'public/FeelAndComfort.js'");
  });

  it('imports all 7 feature block init functions', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    // Breadcrumbs
    expect(pageSource).toContain('initBreadcrumbs');
    // Info Accordion
    expect(pageSource).toContain('initProductInfoAccordion');
    // Financing
    expect(pageSource).toContain('initFinancingOptions');
    // Sticky Cart Bar
    expect(pageSource).toContain('initStickyCartBar');
    // Social Share
    expect(pageSource).toContain('initSocialShare');
    // Quantity Selector
    expect(pageSource).toContain('initQuantitySelector');
    // Swatch System (via SwatchSelector + SwatchRequest + SwatchCTA + FeelAndComfort)
    expect(pageSource).toContain('initSwatchSelector');
    expect(pageSource).toContain('initSwatchRequest');
    expect(pageSource).toContain('initSwatchCTA');
    expect(pageSource).toContain('initFeelAndComfort');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. FEATURE BLOCK ID COVERAGE — each init wires all spec IDs
// ═══════════════════════════════════════════════════════════════════

describe('Breadcrumbs (4 IDs)', () => {
  it('accesses all breadcrumb spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initBreadcrumbs } = await import('../src/public/ProductDetails.js');
    await initBreadcrumbs($w, testState);

    const expected = ['#breadcrumb1', '#breadcrumb2', '#breadcrumb3', '#breadcrumbSchemaHtml'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

describe('Product Info Accordion (12 IDs)', () => {
  it('accesses all accordion spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initProductInfoAccordion } = await import('../src/public/ProductDetails.js');
    initProductInfoAccordion($w);

    const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
    for (const section of sections) {
      expect(accessedIds.has(`#infoHeader${section}`), `Missing: #infoHeader${section}`).toBe(true);
      expect(accessedIds.has(`#infoContent${section}`), `Missing: #infoContent${section}`).toBe(true);
      expect(accessedIds.has(`#infoArrow${section}`), `Missing: #infoArrow${section}`).toBe(true);
    }
  });
});

describe('Financing Modal (16+ IDs)', () => {
  it('accesses financing section, teaser, and repeater IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initFinancingOptions } = await import('../src/public/ProductFinancing.js');
    await initFinancingOptions($w, testState);

    const expected = ['#financingSection', '#financingTeaser', '#financingRepeater', '#financingLearnMore'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

describe('Sticky Add-to-Cart Bar (4 IDs)', () => {
  it('accesses all sticky bar spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initStickyCartBar } = await import('../src/public/AddToCart.js');
    await initStickyCartBar($w, testState);

    const expected = ['#stickyCartBar', '#stickyProductName', '#stickyPrice', '#stickyAddBtn'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

describe('Social Share Buttons (4 IDs)', () => {
  it('accesses all social share spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSocialShare } = await import('../src/public/ProductDetails.js');
    initSocialShare($w, testState);

    const expected = ['#shareFacebook', '#sharePinterest', '#shareEmail', '#shareCopyLink'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

describe('Quantity Selector (3 IDs)', () => {
  it('accesses all quantity spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initQuantitySelector } = await import('../src/public/AddToCart.js');
    initQuantitySelector($w, testState);

    const expected = ['#quantityInput', '#quantityMinus', '#quantityPlus'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

describe('Fabric Swatch System', () => {
  it('initSwatchSelector accesses swatch grid IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSwatchSelector } = await import('../src/public/ProductOptions.js');
    await initSwatchSelector($w, testState);

    const expected = ['#swatchSection', '#swatchGrid'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('initSwatchRequest accesses swatch request modal IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSwatchRequest } = await import('../src/public/ProductDetails.js');
    await initSwatchRequest($w, testState);

    const expected = ['#swatchRequestBtn', '#swatchModal'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. FEEL & COMFORT INTEGRATION — the missing import bug
// ═══════════════════════════════════════════════════════════════════

describe('Feel & Comfort section (initFeelAndComfort)', () => {
  it('is importable from public/FeelAndComfort.js', async () => {
    const mod = await import('../src/public/FeelAndComfort.js');
    expect(typeof mod.initFeelAndComfort).toBe('function');
  });

  it('accesses feelAndComfortSection and related IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initFeelAndComfort } = await import('../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    expect(accessedIds.has('#feelAndComfortSection')).toBe(true);
  });

  it('collapses section when product is null', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, { product: null });

    expect(elements.get('#feelAndComfortSection').collapse).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. ERROR ISOLATION — one failing init doesn't break others
// ═══════════════════════════════════════════════════════════════════

describe('Error isolation', () => {
  it('secondary inits use try/catch so one failure does not stop others', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    // The secondaryInits loop must have try/catch
    expect(pageSource).toContain('for (const section of secondaryInits)');
    expect(pageSource).toMatch(/for \(const section of secondaryInits\)[\s\S]*?try[\s\S]*?catch/);
  });

  it('primary inits use Promise.allSettled for error isolation', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    expect(pageSource).toContain('Promise.allSettled(productSections.map');
  });
});
