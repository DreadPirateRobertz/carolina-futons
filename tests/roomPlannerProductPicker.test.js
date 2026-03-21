import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getProductList, formatProductDims } from '../src/public/roomPlannerHelpers.js';

// ── Helper unit tests ────────────────────────────────────────────────

describe('getProductList', () => {
  it('returns a flat array of all products', () => {
    const list = getProductList();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(4);
  });

  it('each item has required fields', () => {
    const list = getProductList();
    for (const item of list) {
      expect(item).toHaveProperty('productType');
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('categoryLabel');
      expect(item).toHaveProperty('width');
      expect(item).toHaveProperty('depth');
      expect(item).toHaveProperty('depthBed');
    }
  });

  it('includes futon frames with correct category labels', () => {
    const list = getProductList();
    const futonFrames = list.filter(p => p.category === 'futon-frames');
    expect(futonFrames.length).toBeGreaterThanOrEqual(1);
    expect(futonFrames[0].categoryLabel).toBe('Futon Frames');
  });

  it('includes storage items with correct category labels', () => {
    const list = getProductList();
    const storage = list.filter(p => p.category === 'storage');
    expect(storage.length).toBeGreaterThanOrEqual(1);
    expect(storage[0].categoryLabel).toBe('Storage');
  });

  it('includes accessories with correct category labels', () => {
    const list = getProductList();
    const accessories = list.filter(p => p.category === 'accessories');
    expect(accessories.length).toBeGreaterThanOrEqual(1);
    expect(accessories[0].categoryLabel).toBe('Accessories');
  });

  it('all items have positive dimensions', () => {
    const list = getProductList();
    for (const item of list) {
      expect(item.width).toBeGreaterThan(0);
      expect(item.depth).toBeGreaterThan(0);
      expect(item.depthBed).toBeGreaterThan(0);
    }
  });
});

// ── formatProductDims ────────────────────────────────────────────────

describe('formatProductDims', () => {
  it('formats simple product (depth === depthBed) as W" × D"', () => {
    const result = formatProductDims({ width: 20, depth: 20, depthBed: 20 });
    expect(result).toBe('20" × 20"');
  });

  it('formats futon with different bed depth as sofa/bed format', () => {
    const result = formatProductDims({ width: 82, depth: 38, depthBed: 54 });
    expect(result).toContain('82"');
    expect(result).toContain('38"');
    expect(result).toContain('54"');
    expect(result).toContain('sofa');
    expect(result).toContain('bed');
  });

  it('formats coffee table (no bed mode) as simple dims', () => {
    const result = formatProductDims({ width: 48, depth: 24, depthBed: 24 });
    expect(result).toBe('48" × 24"');
  });

  it('formats queen futon with correct bed depth', () => {
    const result = formatProductDims({ width: 88, depth: 40, depthBed: 60 });
    expect(result).toMatch(/88".*40".*sofa/);
    expect(result).toMatch(/60".*bed/);
  });
});

// ── plannerProductRepeater page integration ──────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    data: [],
    options: [],
    accessibility: { ariaLabel: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    postMessage: vi.fn(),
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

vi.mock('backend/roomPlanner.web', () => ({
  getProductDimensions: vi.fn().mockResolvedValue({ success: true, products: [] }),
  createRoomLayout: vi.fn().mockResolvedValue({ success: true, id: 'layout-1', shareId: 'abc12345' }),
  addProductToLayout: vi.fn().mockResolvedValue({ success: true }),
  saveLayout: vi.fn().mockResolvedValue({ success: true }),
  shareLayout: vi.fn().mockResolvedValue({ success: true, shareUrl: '' }),
}));

vi.mock('public/engagementTracker', () => ({ trackEvent: vi.fn() }));
vi.mock('public/mobileHelpers', () => ({ initBackToTop: vi.fn() }));
vi.mock('public/roomPlannerMobile.js', () => ({ initMobileRoomPlanner: vi.fn() }));
vi.mock('public/a11yHelpers.js', () => ({ makeClickable: vi.fn(), announce: vi.fn() }));
vi.mock('public/pageSeo.js', () => ({ initPageSeo: vi.fn() }));
vi.mock('public/roomPlannerHelpers.js', async () => {
  const actual = await vi.importActual('../src/public/roomPlannerHelpers.js');
  return actual;
});

describe('plannerProductRepeater — page integration', () => {
  beforeEach(() => {
    elements.clear();
    onReadyHandler = null;
    vi.resetModules();
  });

  it('sets up plannerProductRepeater with onItemReady', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#plannerProductRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
  });

  it('populates plannerProductRepeater with all products', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#plannerProductRepeater');
    expect(repeater.data.length).toBeGreaterThanOrEqual(4);
    expect(repeater.data.every(item => item._id)).toBe(true);
  });

  it('sets aria label on plannerProductRepeater', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();
    const repeater = getEl('#plannerProductRepeater');
    expect(repeater.accessibility.ariaLabel).toBeTruthy();
  });

  it('onItemReady sets plannerProductName text', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'futon-frame-full',
      label: 'Full Futon Frame',
      category: 'futon-frames',
      categoryLabel: 'Futon Frames',
      width: 82,
      depth: 38,
      depthBed: 54,
      _id: 'product-0',
    };

    onItemReadyFn($item, itemData);

    expect($item('#plannerProductName').text).toBe('Full Futon Frame');
  });

  it('onItemReady sets plannerProductDims with sofa/bed format for futons', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'futon-frame-full',
      label: 'Full Futon Frame',
      category: 'futon-frames',
      categoryLabel: 'Futon Frames',
      width: 82,
      depth: 38,
      depthBed: 54,
      _id: 'product-0',
    };

    onItemReadyFn($item, itemData);

    const dimsText = $item('#plannerProductDims').text;
    expect(dimsText).toContain('82"');
    expect(dimsText).toContain('sofa');
    expect(dimsText).toContain('bed');
  });

  it('onItemReady sets plannerProductCategory text', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'coffee-table',
      label: 'Coffee Table',
      category: 'accessories',
      categoryLabel: 'Accessories',
      width: 48,
      depth: 24,
      depthBed: 24,
      _id: 'product-6',
    };

    onItemReadyFn($item, itemData);

    expect($item('#plannerProductCategory').text).toBe('Accessories');
  });

  it('plannerAddBtn onClick sends addProduct postMessage to plannerCanvas', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'futon-frame-queen',
      label: 'Queen Futon Frame',
      category: 'futon-frames',
      categoryLabel: 'Futon Frames',
      width: 88,
      depth: 40,
      depthBed: 60,
      _id: 'product-1',
    };

    onItemReadyFn($item, itemData);

    // Simulate clicking the add button
    const addBtnClickHandler = $item('#plannerAddBtn').onClick.mock.calls[0][0];
    addBtnClickHandler();

    const canvas = getEl('#plannerCanvas');
    expect(canvas.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'addProduct',
        product: expect.objectContaining({
          productType: 'futon-frame-queen',
          label: 'Queen Futon Frame',
          width: 88,
          depth: 40,
          depthBed: 60,
        }),
      })
    );
  });

  it('plannerAddBtn onClick tracks room_planner_add_product event', async () => {
    const { trackEvent } = await import('public/engagementTracker');
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'storage-ottoman',
      label: 'Storage Ottoman',
      category: 'storage',
      categoryLabel: 'Storage',
      width: 36,
      depth: 18,
      depthBed: 18,
      _id: 'product-5',
    };

    onItemReadyFn($item, itemData);
    const addBtnClickHandler = $item('#plannerAddBtn').onClick.mock.calls[0][0];
    addBtnClickHandler();

    expect(trackEvent).toHaveBeenCalledWith(
      'room_planner_add_product',
      expect.objectContaining({ productType: 'storage-ottoman' })
    );
  });

  it('added product has a unique id field', async () => {
    await import('../src/pages/Room Planner.js');
    await onReadyHandler();

    const repeater = getEl('#plannerProductRepeater');
    const onItemReadyFn = repeater.onItemReady.mock.calls[0][0];

    const itemElements = new Map();
    const $item = (sel) => {
      if (!itemElements.has(sel)) itemElements.set(sel, createMockElement());
      return itemElements.get(sel);
    };

    const itemData = {
      productType: 'end-table',
      label: 'End Table',
      category: 'accessories',
      categoryLabel: 'Accessories',
      width: 20,
      depth: 20,
      depthBed: 20,
      _id: 'product-7',
    };

    onItemReadyFn($item, itemData);
    const addBtnClickHandler = $item('#plannerAddBtn').onClick.mock.calls[0][0];
    addBtnClickHandler();

    const canvas = getEl('#plannerCanvas');
    const call = canvas.postMessage.mock.calls[0][0];
    expect(call.product.id).toBeTruthy();
    expect(typeof call.product.id).toBe('string');
  });
});
