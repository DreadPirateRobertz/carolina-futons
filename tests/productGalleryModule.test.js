import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────

const elements = new Map();

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', data: [],
    items: [],
    style: {}, accessibility: {},
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemClicked: vi.fn(), onItemReady: vi.fn(),
    onKeyPress: vi.fn(),
    getElement: vi.fn(() => null),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const $w = (sel) => getEl(sel);

// ── Mock Dependencies ───────────────────────────────────────────────

vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn(() => []),
  getProductBadge: vi.fn(() => null),
  initImageLightbox: vi.fn(),
  initImageZoom: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'fallback.jpg'),
  getPlaceholderProductImages: vi.fn(() => ['ph1.jpg', 'ph2.jpg', 'ph3.jpg', 'ph4.jpg']),
}));

vi.mock('backend/seoHelpers.web', () => ({
  generateAltText: vi.fn(() => Promise.resolve('Generated alt text')),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(),
}));

vi.mock('public/engagementTracker', () => ({
  trackGalleryInteraction: vi.fn(),
}));

vi.mock('public/product/productSchema.js', () => ({
  buildGridAlt: vi.fn((p) => `alt-${p.name}`),
}));

vi.mock('wix-location-frontend', () => ({
  to: vi.fn(),
}));

const { getRecentlyViewed, getProductBadge, initImageLightbox, initImageZoom } =
  await import('public/galleryHelpers.js');
const { getProductFallbackImage, getPlaceholderProductImages } = await import('public/placeholderImages.js');
const { generateAltText } = await import('backend/seoHelpers.web');

const { initImageGallery, loadRecentlyViewed, initProductBadge } =
  await import('../carolina-futons-stage3-velo/src/public/product/productGallery.js');

// ── Tests ───────────────────────────────────────────────────────────

describe('initImageGallery', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('sets fallback image when product has no mainMedia', () => {
    const product = { collections: ['futons'], mediaItems: [] };
    initImageGallery($w, product);
    expect(getEl('#productMainImage').src).toBe('fallback.jpg');
  });

  it('generates alt text for main image', () => {
    const product = { mainMedia: 'real.jpg', mediaItems: [] };
    initImageGallery($w, product);
    expect(generateAltText).toHaveBeenCalledWith(product, 'main');
  });

  it('fills gallery with placeholders when fewer than 3 media items', () => {
    const product = { name: 'Futon', mainMedia: 'img.jpg', mediaItems: [{ src: 'a.jpg' }], collections: ['futons'] };
    initImageGallery($w, product);
    const gallery = getEl('#productGallery');
    expect(gallery.items.length).toBeGreaterThanOrEqual(1);
  });

  it('registers onItemClicked on gallery', () => {
    const product = { mainMedia: 'img.jpg', mediaItems: [] };
    initImageGallery($w, product);
    expect(getEl('#productGallery').onItemClicked).toHaveBeenCalled();
  });

  it('onItemClicked updates main image', () => {
    const product = { name: 'F', mainMedia: 'img.jpg', mediaItems: [] };
    initImageGallery($w, product);
    const callback = getEl('#productGallery').onItemClicked.mock.calls[0][0];
    callback({ item: { src: 'clicked.jpg', title: 'Clicked Image' } });
    expect(getEl('#productMainImage').src).toBe('clicked.jpg');
    expect(getEl('#productMainImage').alt).toBe('Clicked Image');
  });

  it('initializes lightbox', () => {
    const product = { mainMedia: 'img.jpg', mediaItems: [] };
    initImageGallery($w, product);
    expect(initImageLightbox).toHaveBeenCalled();
  });

  it('initializes zoom', () => {
    const product = { mainMedia: 'img.jpg', mediaItems: [] };
    initImageGallery($w, product);
    expect(initImageZoom).toHaveBeenCalled();
  });
});

describe('loadRecentlyViewed', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('collapses section when no recently viewed', async () => {
    getRecentlyViewed.mockReturnValue([]);
    await loadRecentlyViewed($w, { _id: 'p1' });
    expect(getEl('#recentlyViewedSection').collapse).toHaveBeenCalled();
  });

  it('expands section and sets repeater data when items exist', async () => {
    const items = [{ _id: 'r1', name: 'R1', mainMedia: 'r.jpg', price: '$99', slug: 'r1' }];
    getRecentlyViewed.mockReturnValue(items);
    await loadRecentlyViewed($w, { _id: 'p1' });
    expect(getEl('#recentlyViewedSection').expand).toHaveBeenCalled();
    expect(getEl('#recentlyViewedRepeater').data).toEqual(items);
  });

  it('registers onItemReady on repeater', async () => {
    getRecentlyViewed.mockReturnValue([{ _id: 'r1', name: 'R', mainMedia: 'r.jpg', price: '$1', slug: 'r' }]);
    await loadRecentlyViewed($w, { _id: 'p1' });
    expect(getEl('#recentlyViewedRepeater').onItemReady).toHaveBeenCalled();
  });

  it('onItemReady sets image, alt, name, price', async () => {
    const items = [{ _id: 'r1', name: 'RecentProd', mainMedia: 'rp.jpg', price: '$50', slug: 'rp' }];
    getRecentlyViewed.mockReturnValue(items);
    await loadRecentlyViewed($w, { _id: 'p1' });

    const callback = getEl('#recentlyViewedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, items[0]);

    expect($item('#recentImage').src).toBe('rp.jpg');
    expect($item('#recentImage').alt).toBe('alt-RecentProd');
    expect($item('#recentName').text).toBe('RecentProd');
    expect($item('#recentPrice').text).toBe('$50');
  });

  it('sets keyboard a11y on recent items', async () => {
    const items = [{ _id: 'r1', name: 'R', mainMedia: 'r.jpg', price: '$1', slug: 'r' }];
    getRecentlyViewed.mockReturnValue(items);
    await loadRecentlyViewed($w, { _id: 'p1' });

    const callback = getEl('#recentlyViewedRepeater').onItemReady.mock.calls[0][0];
    const itemEls = new Map();
    const $item = (sel) => {
      if (!itemEls.has(sel)) itemEls.set(sel, createMockElement());
      return itemEls.get(sel);
    };
    callback($item, items[0]);

    expect($item('#recentImage').accessibility.tabIndex).toBe(0);
    expect($item('#recentImage').accessibility.role).toBe('link');
    expect($item('#recentImage').onKeyPress).toHaveBeenCalled();
  });
});

describe('initProductBadge', () => {
  beforeEach(() => { elements.clear(); vi.clearAllMocks(); });

  it('shows badge when product has one', () => {
    getProductBadge.mockReturnValue('Sale');
    initProductBadge($w, { _id: 'p1' });
    expect(getEl('#productBadgeOverlay').text).toBe('Sale');
    expect(getEl('#productBadgeOverlay').show).toHaveBeenCalled();
  });

  it('hides badge when product has none', () => {
    getProductBadge.mockReturnValue(null);
    initProductBadge($w, { _id: 'p1' });
    expect(getEl('#productBadgeOverlay').hide).toHaveBeenCalled();
  });
});
