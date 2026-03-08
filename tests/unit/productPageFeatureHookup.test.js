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
      focus: vi.fn(),
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

vi.mock('backend/financingCalc.web', () => ({
  getFinancingWidget: vi.fn().mockResolvedValue({
    success: true,
    price: 500,
    eligible: true,
    minimumAmount: 200,
    terms: [
      { months: 6, apr: 0, label: '6 Months', description: '0% APR for 6 months', monthly: 83.33, total: 500, interest: 0, isZeroInterest: true },
    ],
    afterpay: {
      eligible: true,
      installments: 4,
      installmentAmount: 125,
      total: 500,
      message: 'or 4 interest-free payments of $125.00 with Afterpay',
    },
    lowestMonthly: 'As low as $84/mo',
    widgetData: {
      showWidget: true,
      sections: [
        { type: 'afterpay', title: 'Pay in 4', subtitle: 'Interest-free with Afterpay', highlight: '$125.00/payment' },
        { type: 'financing', title: '6 Months', subtitle: '0% APR for 6 months', highlight: '$83.33/mo', details: { monthly: 83.33, total: 500, interest: 0, apr: 0 } },
      ],
      defaultSection: 0,
      minimumAmount: 200,
      belowMinimum: false,
      belowMinimumMessage: null,
    },
  }),
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
  setupAccessibleDialog: vi.fn(() => ({ open: vi.fn(), close: vi.fn() })),
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

  it('references initFeelAndComfort from FeelAndComfort.js', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../../src/pages/Product Page.js', import.meta.url), 'utf8')
    );
    // May be statically imported or dynamically imported — either is valid
    expect(pageSource).toContain("initFeelAndComfort");
    expect(pageSource).toContain("FeelAndComfort.js");
  });

  it('imports all 7 feature block init functions', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../../src/pages/Product Page.js', import.meta.url), 'utf8')
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

  it('places all 7 feature inits in the sections array', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    // All features present in the unified sections array (critical or deferred)
    expect(pageSource).toMatch(/sections[\s\S]*?swatchSelector/);
    expect(pageSource).toMatch(/sections[\s\S]*?breadcrumbs/);
    expect(pageSource).toMatch(/sections[\s\S]*?quantitySelector/);
    expect(pageSource).toMatch(/sections[\s\S]*?financingOptions/);
    expect(pageSource).toMatch(/sections[\s\S]*?socialShare/);
    expect(pageSource).toMatch(/sections[\s\S]*?stickyCartBar/);
    expect(pageSource).toMatch(/sections[\s\S]*?feelAndComfort/);
    expect(pageSource).toMatch(/sections[\s\S]*?swatchRequest/);
    expect(pageSource).toMatch(/sections[\s\S]*?swatchCTA/);
    expect(pageSource).toMatch(/sections[\s\S]*?productInfoAccordion/);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. FEATURE BLOCK ID COVERAGE — each init wires all spec IDs
// ═══════════════════════════════════════════════════════════════════

describe('Breadcrumbs (4 IDs)', () => {
  it('accesses all breadcrumb spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initBreadcrumbs } = await import('../../src/public/ProductDetails.js');
    await initBreadcrumbs($w, testState);

    const expected = ['#breadcrumb1', '#breadcrumb2', '#breadcrumb3', '#breadcrumbSchemaHtml'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('sets breadcrumb text from product data', async () => {
    const { $w, elements } = createTrackingMock();
    const { initBreadcrumbs } = await import('../../src/public/ProductDetails.js');
    await initBreadcrumbs($w, testState);

    // Last breadcrumb should contain product name
    expect(elements.get('#breadcrumb3').text).toContain(testProduct.name);
  });
});

describe('Product Info Accordion (12 IDs)', () => {
  it('accesses all 12 accordion spec IDs (4 sections × 3)', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initProductInfoAccordion } = await import('../../src/public/ProductDetails.js');
    initProductInfoAccordion($w);

    const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
    for (const section of sections) {
      expect(accessedIds.has(`#infoHeader${section}`), `Missing: #infoHeader${section}`).toBe(true);
      expect(accessedIds.has(`#infoContent${section}`), `Missing: #infoContent${section}`).toBe(true);
      expect(accessedIds.has(`#infoArrow${section}`), `Missing: #infoArrow${section}`).toBe(true);
    }
  });

  it('registers click handlers on all section headers', async () => {
    const { $w, elements } = createTrackingMock();
    const { initProductInfoAccordion } = await import('../../src/public/ProductDetails.js');
    initProductInfoAccordion($w);

    const sections = ['Description', 'Dimensions', 'Care', 'Shipping'];
    for (const section of sections) {
      expect(elements.get(`#infoHeader${section}`).onClick).toHaveBeenCalled();
    }
  });

  it('expands Description and collapses other sections initially', async () => {
    const { $w, elements } = createTrackingMock();
    const { initProductInfoAccordion } = await import('../../src/public/ProductDetails.js');
    initProductInfoAccordion($w);

    // Description expanded by default
    expect(elements.get('#infoContentDescription').expand).toHaveBeenCalled();

    // Others collapsed
    for (const section of ['Dimensions', 'Care', 'Shipping']) {
      expect(elements.get(`#infoContent${section}`).collapse).toHaveBeenCalled();
    }
  });
});

describe('Financing Modal (16 IDs)', () => {
  it('accesses core financing IDs during init', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await initFinancingOptions($w, testState);

    const expected = [
      '#financingSection', '#financingTeaser', '#financingRepeater',
      '#financingLearnMore', '#financingClose', '#financingOverlay',
      '#afterpayMessage',
    ];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('sets teaser text from backend response', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await initFinancingOptions($w, testState);

    expect(elements.get('#financingTeaser').text).toBe('As low as $84/mo');
  });

  it('populates plan repeater with financing data', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await initFinancingOptions($w, testState);

    const repeater = elements.get('#financingRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data.length).toBeGreaterThan(0);
  });

  it('collapses section when product has no price', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await initFinancingOptions($w, { product: { ...testProduct, price: 0 } });

    expect(elements.get('#financingSection').collapse).toHaveBeenCalled();
  });

  it('collapses section when backend returns not eligible', async () => {
    const { getFinancingWidget } = await import('backend/financingCalc.web');
    getFinancingWidget.mockResolvedValueOnce({
      success: true,
      eligible: false,
      widgetData: { showWidget: false, sections: [] },
    });

    const { $w, elements } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await initFinancingOptions($w, testState);

    expect(elements.get('#financingSection').collapse).toHaveBeenCalled();
  });
});

describe('Sticky Add-to-Cart Bar (4 IDs)', () => {
  it('accesses all sticky bar spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initStickyCartBar } = await import('../../src/public/AddToCart.js');
    await initStickyCartBar($w, testState);

    const expected = ['#stickyCartBar', '#stickyProductName', '#stickyPrice', '#stickyAddBtn'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('displays product name and price in sticky bar', async () => {
    const { $w, elements } = createTrackingMock();
    const { initStickyCartBar } = await import('../../src/public/AddToCart.js');
    await initStickyCartBar($w, testState);

    expect(elements.get('#stickyProductName').text).toBe(testProduct.name);
    expect(elements.get('#stickyPrice').text).toBe(testProduct.formattedPrice);
  });

  it('registers click handler on sticky add button', async () => {
    const { $w, elements } = createTrackingMock();
    const { initStickyCartBar } = await import('../../src/public/AddToCart.js');
    await initStickyCartBar($w, testState);

    expect(elements.get('#stickyAddBtn').onClick).toHaveBeenCalled();
  });
});

describe('Social Share Buttons (4 IDs)', () => {
  it('accesses all social share spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSocialShare } = await import('../../src/public/ProductDetails.js');
    initSocialShare($w, testState);

    const expected = ['#shareFacebook', '#sharePinterest', '#shareEmail', '#shareCopyLink'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('registers click handlers via makeClickable on share buttons', async () => {
    const { $w } = createTrackingMock();
    const { makeClickable } = await import('public/a11yHelpers.js');
    makeClickable.mockClear();

    const { initSocialShare } = await import('../../src/public/ProductDetails.js');
    initSocialShare($w, testState);

    // makeClickable should be called for each share button
    expect(makeClickable.mock.calls.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Quantity Selector (3 IDs)', () => {
  it('accesses all quantity spec IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initQuantitySelector } = await import('../../src/public/AddToCart.js');
    initQuantitySelector($w, testState);

    const expected = ['#quantityInput', '#quantityMinus', '#quantityPlus'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('sets initial quantity to 1', async () => {
    const { $w, elements } = createTrackingMock();
    const { initQuantitySelector } = await import('../../src/public/AddToCart.js');
    initQuantitySelector($w, testState);

    expect(String(elements.get('#quantityInput').value)).toBe('1');
  });

  it('registers click handlers on plus and minus buttons', async () => {
    const { $w, elements } = createTrackingMock();
    const { initQuantitySelector } = await import('../../src/public/AddToCart.js');
    initQuantitySelector($w, testState);

    expect(elements.get('#quantityMinus').onClick).toHaveBeenCalled();
    expect(elements.get('#quantityPlus').onClick).toHaveBeenCalled();
  });
});

describe('Fabric Swatch System', () => {
  it('initSwatchSelector accesses all 6 swatch grid IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSwatchSelector } = await import('../../src/public/ProductOptions.js');
    await initSwatchSelector($w, testState);

    const expected = [
      '#swatchSection', '#swatchGrid', '#swatchCount',
      '#swatchViewAll', '#swatchRequestLink', '#swatchColorFilter',
    ];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('initSwatchRequest accesses request button, modal, and submit IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSwatchRequest } = await import('../../src/public/ProductDetails.js');
    await initSwatchRequest($w, testState);

    const expected = ['#swatchRequestBtn', '#swatchModal', '#swatchSubmit'];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('initSwatchCTA accesses the CTA button', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initSwatchCTA } = await import('../../src/public/ProductDetails.js');
    initSwatchCTA($w, testState);

    expect(accessedIds.has('#swatchCTABtn'), 'Missing ID: #swatchCTABtn').toBe(true);
  });

  it('initSwatchCTA sets coral styling on CTA button', async () => {
    const { $w, elements } = createTrackingMock();
    const { initSwatchCTA } = await import('../../src/public/ProductDetails.js');
    initSwatchCTA($w, testState);

    expect(elements.get('#swatchCTABtn').style.backgroundColor).toBe('#E8845C');
  });

  it('initSwatchSelector populates grid with swatch data', async () => {
    const { $w, elements } = createTrackingMock();
    const { initSwatchSelector } = await import('../../src/public/ProductOptions.js');
    await initSwatchSelector($w, testState);

    const grid = elements.get('#swatchGrid');
    expect(grid.onItemReady).toHaveBeenCalled();
  });

  it('initSwatchRequest hides when product has no fabric options', async () => {
    const { $w, elements } = createTrackingMock();
    const { initSwatchRequest } = await import('../../src/public/ProductDetails.js');
    const noFabricState = {
      product: { ...testProduct, productOptions: [{ name: 'Size', choices: [{ value: 'Small' }] }] },
    };
    await initSwatchRequest($w, noFabricState);

    expect(elements.get('#swatchRequestBtn').hide).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. FEEL & COMFORT INTEGRATION
// ═══════════════════════════════════════════════════════════════════

describe('Feel & Comfort section (initFeelAndComfort)', () => {
  it('is importable from public/FeelAndComfort.js', async () => {
    const mod = await import('../../src/public/FeelAndComfort.js');
    expect(typeof mod.initFeelAndComfort).toBe('function');
  });

  it('accesses all section-level IDs', async () => {
    const { $w, accessedIds } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    const expected = [
      '#feelAndComfortSection', '#feelAndComfortTitle',
      '#comfortSection', '#feelSwatchPreview', '#feelSwatchCTA',
    ];
    for (const id of expected) {
      expect(accessedIds.has(id), `Missing ID: ${id}`).toBe(true);
    }
  });

  it('collapses section when product is null', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, { product: null });

    expect(elements.get('#feelAndComfortSection').collapse).toHaveBeenCalled();
  });

  it('expands comfort subsection when comfort data is available', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    expect(elements.get('#comfortSection').expand).toHaveBeenCalled();
  });

  it('sets title text to "Feel & Comfort"', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    expect(elements.get('#feelAndComfortTitle').text).toBe('Feel & Comfort');
  });

  it('shows CTA with coral styling when swatches available', async () => {
    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    const cta = elements.get('#feelSwatchCTA');
    expect(cta.show).toHaveBeenCalled();
    expect(cta.style.backgroundColor).toBe('#E8845C');
  });

  it('collapses section when both comfort and swatches are empty', async () => {
    const { getProductComfort } = await import('backend/comfortService.web');
    const { getProductSwatches } = await import('backend/swatchService.web');
    getProductComfort.mockResolvedValueOnce(null);
    getProductSwatches.mockResolvedValueOnce([]);

    const { $w, elements } = createTrackingMock();
    const { initFeelAndComfort } = await import('../../src/public/FeelAndComfort.js');
    await initFeelAndComfort($w, testState);

    expect(elements.get('#feelAndComfortSection').collapse).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. ERROR ISOLATION — one failing init doesn't break others
// ═══════════════════════════════════════════════════════════════════

describe('Error isolation', () => {
  it('uses prioritizeSections for error-isolated critical/deferred split', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    // Uses prioritizeSections which internally uses Promise.allSettled
    expect(pageSource).toContain('prioritizeSections(sections');
    // Has both critical and deferred sections
    expect(pageSource).toContain('critical: true');
    expect(pageSource).toContain('critical: false');
  });

  it('has onError callback for deferred section failures', async () => {
    const pageSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../../src/pages/Product Page.js', import.meta.url), 'utf8')
    );

    expect(pageSource).toContain('onError:');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. NULL / MISSING PRODUCT GRACEFUL DEGRADATION
// ═══════════════════════════════════════════════════════════════════

describe('Graceful degradation with null product', () => {
  const nullState = { product: null };

  it('initBreadcrumbs handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initBreadcrumbs } = await import('../../src/public/ProductDetails.js');
    await expect(initBreadcrumbs($w, nullState)).resolves.not.toThrow();
  });

  it('initFinancingOptions handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initFinancingOptions } = await import('../../src/public/ProductFinancing.js');
    await expect(initFinancingOptions($w, nullState)).resolves.not.toThrow();
  });

  it('initStickyCartBar handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initStickyCartBar } = await import('../../src/public/AddToCart.js');
    expect(() => initStickyCartBar($w, nullState)).not.toThrow();
  });

  it('initSwatchSelector handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initSwatchSelector } = await import('../../src/public/ProductOptions.js');
    await expect(initSwatchSelector($w, nullState)).resolves.not.toThrow();
  });

  it('initQuantitySelector handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initQuantitySelector } = await import('../../src/public/AddToCart.js');
    expect(() => initQuantitySelector($w, nullState)).not.toThrow();
  });

  it('initSocialShare handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initSocialShare } = await import('../../src/public/ProductDetails.js');
    expect(() => initSocialShare($w, nullState)).not.toThrow();
  });

  it('initSwatchCTA handles null product without throwing', async () => {
    const { $w } = createTrackingMock();
    const { initSwatchCTA } = await import('../../src/public/ProductDetails.js');
    expect(() => initSwatchCTA($w, nullState)).not.toThrow();
  });
});
