import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    style: {}, accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    enable: vi.fn(), disable: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('backend/productRecommendations.web', () => ({
  getRelatedProducts: vi.fn(() => Promise.resolve([])),
  getSameCollection: vi.fn(() => Promise.resolve([])),
  getBundleSuggestion: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('public/cartService', () => ({
  addToCart: vi.fn(() => Promise.resolve()),
}));

vi.mock('public/engagementTracker', () => ({
  trackCartAdd: vi.fn(),
}));

vi.mock('public/product/variantSelector.js', () => ({
  formatCurrency: vi.fn((val) => `$${val}`),
}));

vi.mock('public/product/productSchema.js', () => ({
  buildGridAlt: vi.fn((p) => `alt-${p.name}`),
}));

vi.mock('public/a11yHelpers.js', () => ({
  makeClickable: vi.fn(),
}));

vi.mock('public/productPageUtils.js', () => ({
  isCallForPrice: vi.fn(() => false),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { getRelatedProducts, getSameCollection, getBundleSuggestion } =
  await import('backend/productRecommendations.web');
const { addToCart } = await import('public/cartService');
const { makeClickable } = await import('public/a11yHelpers.js');
const { to: wixTo } = await import('wix-location-frontend');

const { loadRelatedProducts, loadCollectionProducts, initBundleSection } =
  await import('../src/public/product/crossSell.js');

// ── Tests ───────────────────────────────────────────────────────────

describe('loadRelatedProducts', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('does nothing when no product', async () => {
    await loadRelatedProducts($w, null);
    expect(getRelatedProducts).not.toHaveBeenCalled();
  });

  it('collapses section when no related products', async () => {
    getRelatedProducts.mockResolvedValue([]);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['futons'] });
    expect(getEl('#relatedSection').collapse).toHaveBeenCalled();
  });

  it('sets repeater data when related products exist', async () => {
    const products = [
      { _id: 'r1', name: 'Related 1', mainMedia: 'img.jpg', formattedPrice: '$99', slug: 'r1' },
    ];
    getRelatedProducts.mockResolvedValue(products);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['futons'] });
    expect(getEl('#relatedRepeater').data).toEqual(products);
  });

  it('registers onItemReady on repeater', async () => {
    getRelatedProducts.mockResolvedValue([{ _id: 'r1', name: 'R1', mainMedia: 'i.jpg', formattedPrice: '$99', slug: 'r1' }]);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c1'] });
    expect(getEl('#relatedRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady sets image, alt, name, price', async () => {
    const products = [{ _id: 'r1', name: 'Prod', mainMedia: 'img.jpg', formattedPrice: '$50', slug: 'slug' }];
    getRelatedProducts.mockResolvedValue(products);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c1'] });

    const callback = getEl('#relatedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    expect($item('#relatedImage').src).toBe('img.jpg');
    expect($item('#relatedName').text).toBe('Prod');
    expect($item('#relatedPrice').text).toBe('$50');
  });

  it('uses makeClickable for a11y navigation', async () => {
    getRelatedProducts.mockResolvedValue([{ _id: 'r1', name: 'R', mainMedia: 'i.jpg', formattedPrice: '$1', slug: 's' }]);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c'] });

    const callback = getEl('#relatedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, { _id: 'r1', name: 'R', mainMedia: 'i.jpg', slug: 's' });
    expect(makeClickable).toHaveBeenCalled();
  });
});

describe('loadCollectionProducts', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('does nothing when no product', async () => {
    await loadCollectionProducts($w, null);
    expect(getSameCollection).not.toHaveBeenCalled();
  });

  it('does nothing when no collections', async () => {
    await loadCollectionProducts($w, { _id: 'p1' });
    expect(getSameCollection).not.toHaveBeenCalled();
  });

  it('collapses section when no collection products', async () => {
    getSameCollection.mockResolvedValue([]);
    await loadCollectionProducts($w, { _id: 'p1', collections: ['futons'] });
    expect(getEl('#collectionSection').collapse).toHaveBeenCalled();
  });

  it('sets repeater data when products exist', async () => {
    const products = [{ _id: 'c1', name: 'C1', mainMedia: 'i.jpg', formattedPrice: '$50', slug: 'c1' }];
    getSameCollection.mockResolvedValue(products);
    await loadCollectionProducts($w, { _id: 'p1', collections: ['futons'] });
    expect(getEl('#collectionRepeater').data).toEqual(products);
  });
});

describe('initBundleSection', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('does nothing when no product', async () => {
    await initBundleSection($w, null);
    expect(getBundleSuggestion).not.toHaveBeenCalled();
  });

  it('collapses section when no bundle', async () => {
    getBundleSuggestion.mockResolvedValue(null);
    await initBundleSection($w, { _id: 'p1' });
    expect(getEl('#bundleSection').collapse).toHaveBeenCalled();
  });

  it('expands section and populates when bundle exists', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'Bundle Prod', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 199,
      savings: 50,
    });
    await initBundleSection($w, { _id: 'p1' });
    expect(getEl('#bundleSection').expand).toHaveBeenCalled();
    expect(getEl('#bundleName').text).toBe('Bundle Prod');
    expect(getEl('#bundleImage').src).toBe('b.jpg');
    expect(getEl('#bundlePrice').text).toBe('$199');
    expect(getEl('#bundleSavings').text).toBe('Save $50');
  });

  it('registers click handler on addBundleBtn', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    await initBundleSection($w, { _id: 'p1' });
    expect(getEl('#addBundleBtn').onClick).toHaveBeenCalled();
  });

  it('addBundleBtn click adds both products to cart', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    const product = { _id: 'p1' };
    await initBundleSection($w, product);
    const clickHandler = getEl('#addBundleBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(addToCart).toHaveBeenCalledWith('p1', 1);
    expect(addToCart).toHaveBeenCalledWith('b1', 1);
  });

  it('uses getQuantity option when provided', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    const product = { _id: 'p1' };
    await initBundleSection($w, product, { getQuantity: () => 3 });
    const clickHandler = getEl('#addBundleBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(addToCart).toHaveBeenCalledWith('p1', 3);
  });

  it('disables button during add', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    await initBundleSection($w, { _id: 'p1' });
    const clickHandler = getEl('#addBundleBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(getEl('#addBundleBtn').disable).toHaveBeenCalled();
  });

  it('shows error label on cart failure', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    addToCart.mockRejectedValueOnce(new Error('Cart error'));
    await initBundleSection($w, { _id: 'p1' });
    const clickHandler = getEl('#addBundleBtn').onClick.mock.calls[0][0];
    await clickHandler();
    expect(getEl('#addBundleBtn').label).toBe('Error — Try Again');
  });

  it('skips adding main product on second click (crossSellMainAdded guard)', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bp' },
      bundlePrice: 100, savings: 20,
    });
    const product = { _id: 'p1' };
    await initBundleSection($w, product);
    const clickHandler = getEl('#addBundleBtn').onClick.mock.calls[0][0];
    // First click — adds both
    await clickHandler();
    const firstCallCount = addToCart.mock.calls.length;
    expect(addToCart).toHaveBeenCalledWith('p1', 1);
    expect(addToCart).toHaveBeenCalledWith('b1', 1);
    // Second click — main product reset, so adds both again
    addToCart.mockClear();
    await clickHandler();
    expect(addToCart).toHaveBeenCalledWith('p1', 1);
    expect(addToCart).toHaveBeenCalledWith('b1', 1);
    expect(firstCallCount).toBe(2);
  });
});

describe('loadCollectionProducts — onItemReady coverage', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('onItemReady sets image src/alt, name, and price', async () => {
    const products = [{ _id: 'c1', name: 'Coll Prod', mainMedia: 'c.jpg', formattedPrice: '$75', slug: 'cp' }];
    getSameCollection.mockResolvedValue(products);
    await loadCollectionProducts($w, { _id: 'p1', collections: ['futons'] });

    const callback = getEl('#collectionRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    expect($item('#collectionImage').src).toBe('c.jpg');
    expect($item('#collectionName').text).toBe('Coll Prod');
  });

  it('navigateToProduct onClick calls wix-location-frontend to()', async () => {
    const products = [{ _id: 'c1', name: 'C', mainMedia: 'c.jpg', formattedPrice: '$50', slug: 'coll-slug' }];
    getSameCollection.mockResolvedValue(products);
    await loadCollectionProducts($w, { _id: 'p1', collections: ['futons'] });

    const callback = getEl('#collectionRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    // Trigger the onClick registered on the image
    const onClickFn = $item('#collectionImage').onClick.mock.calls[0][0];
    onClickFn();
    await new Promise(r => setTimeout(r, 0)); // flush dynamic import chain

    expect(wixTo).toHaveBeenCalledWith('/product-page/coll-slug');
  });
});

describe('loadRelatedProducts — navigation coverage', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('navigateToProduct passed to makeClickable calls wix-location-frontend to()', async () => {
    const products = [{ _id: 'r1', name: 'R', mainMedia: 'i.jpg', formattedPrice: '$50', slug: 'rel-slug' }];
    getRelatedProducts.mockResolvedValue(products);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c1'] });

    const callback = getEl('#relatedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    // makeClickable receives navigateToProduct as its second arg
    const navigateFn = makeClickable.mock.calls[0][1];
    navigateFn();
    await new Promise(r => setTimeout(r, 0));

    expect(wixTo).toHaveBeenCalledWith('/product-page/rel-slug');
  });
});

describe('initBundleSection — navigation and error coverage', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('navigateToBundle onClick calls wix-location-frontend to()', async () => {
    getBundleSuggestion.mockResolvedValue({
      product: { _id: 'b1', name: 'B', mainMedia: 'b.jpg', slug: 'bundle-slug' },
      bundlePrice: 100, savings: 20,
    });
    await initBundleSection($w, { _id: 'p1' });

    const navigateFn = getEl('#bundleImage').onClick.mock.calls[0][0];
    navigateFn();
    await new Promise(r => setTimeout(r, 0));

    expect(wixTo).toHaveBeenCalledWith('/product-page/bundle-slug');
  });

  it('logs error when getBundleSuggestion throws (outer catch)', async () => {
    getBundleSuggestion.mockRejectedValue(new Error('fetch failed'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await initBundleSection($w, { _id: 'p1' });
    expect(spy).toHaveBeenCalledWith('Error loading bundle section:', expect.any(Error));
    spy.mockRestore();
  });
});

describe('loadRelatedProducts — ribbon branch', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('shows ribbon badge when product has ribbon', async () => {
    const products = [{ _id: 'r1', name: 'Sale Prod', mainMedia: 'i.jpg', formattedPrice: '$50', slug: 's', ribbon: 'SALE' }];
    getRelatedProducts.mockResolvedValue(products);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c1'] });

    const callback = getEl('#relatedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    expect($item('#relatedBadge').text).toBe('SALE');
    expect($item('#relatedBadge').show).toHaveBeenCalled();
  });

  it('does not touch badge when product has no ribbon', async () => {
    const products = [{ _id: 'r1', name: 'Prod', mainMedia: 'i.jpg', formattedPrice: '$50', slug: 's' }];
    getRelatedProducts.mockResolvedValue(products);
    await loadRelatedProducts($w, { _id: 'p1', collections: ['c1'] });

    const callback = getEl('#relatedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, products[0]);

    expect($item('#relatedBadge').show).not.toHaveBeenCalled();
  });
});
