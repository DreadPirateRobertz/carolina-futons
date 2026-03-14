import { describe, it, expect, vi, beforeEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

vi.mock('public/galleryConfig.js', () => ({
  getGalleryConfig: vi.fn(() => ({
    thumbnailCount: 4,
    enableZoom: true,
    enableLightbox: true,
    zoomLevel: 2,
    autoPlayGallery: false,
    showThumbnailStrip: true,
    thumbnailPosition: 'bottom',
    mainImageFit: 'contain',
  })),
  getImageDimensions: vi.fn(() => ({ width: 800, height: 800 })),
}));

vi.mock('public/a11yHelpers.js', () => ({ announce: vi.fn() }));

import {
  initGalleryCounter,
  initActiveThumbnail,
  applyGalleryConfig,
  initThumbnailScroll,
} from '../src/public/MultiImageGallery.js';

// ── Test helpers ──────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '',
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: '' },
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(),
    onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), forEachItem: vi.fn(),
    scrollTo: vi.fn(),
    accessibility: {},
    hidden: false,
    collapsed: true,
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._elements = els;
  return $w;
}

function makeState(overrides = {}) {
  return {
    product: {
      ...futonFrame,
      mediaItems: [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'Front View' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'Side View' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'Back View' },
        { src: 'https://example.com/d.jpg', type: 'image', title: 'Detail View' },
        { src: 'https://example.com/e.jpg', type: 'image', title: 'Room View' },
      ],
      collections: ['futon-frames'],
      ...overrides,
    },
  };
}

// ── Gallery Counter ──────────────────────────────────────────────

describe('initGalleryCounter', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
  });

  it('shows initial counter text "1 / N"', () => {
    const state = makeState();
    initGalleryCounter($w, state);
    expect($w('#galleryCounter').text).toBe('1 / 5');
  });

  it('returns update function to change counter', () => {
    const state = makeState();
    const counter = initGalleryCounter($w, state);
    counter.update(3);
    expect($w('#galleryCounter').text).toBe('3 / 5');
  });

  it('clamps index to valid range on update', () => {
    const state = makeState();
    const counter = initGalleryCounter($w, state);
    counter.update(10);
    expect($w('#galleryCounter').text).toBe('5 / 5');
    counter.update(-1);
    expect($w('#galleryCounter').text).toBe('1 / 5');
  });

  it('hides counter when product has 1 or fewer images', () => {
    const state = makeState({
      mediaItems: [{ src: 'https://example.com/only.jpg', type: 'image' }],
    });
    initGalleryCounter($w, state);
    expect($w('#galleryCounter').hide).toHaveBeenCalled();
  });

  it('hides counter when product has no media items', () => {
    const state = makeState({ mediaItems: [] });
    initGalleryCounter($w, state);
    expect($w('#galleryCounter').hide).toHaveBeenCalled();
  });

  it('hides counter when mediaItems is undefined', () => {
    const state = makeState({ mediaItems: undefined });
    initGalleryCounter($w, state);
    expect($w('#galleryCounter').hide).toHaveBeenCalled();
  });

  it('sets ARIA live region on counter for screen readers', () => {
    const state = makeState();
    initGalleryCounter($w, state);
    expect($w('#galleryCounter').accessibility.ariaLive).toBe('polite');
  });

  it('returns no-op when product is null', () => {
    const counter = initGalleryCounter($w, { product: null });
    expect(counter).toBeDefined();
    expect(() => counter.update(2)).not.toThrow();
  });
});

// ── Active Thumbnail ─────────────────────────────────────────────

describe('initActiveThumbnail', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
  });

  it('returns a setActive function', () => {
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    expect(typeof tracker.setActive).toBe('function');
  });

  it('sets initial active index to 0', () => {
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    expect(tracker.getActive()).toBe(0);
  });

  it('updates active index via setActive', () => {
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    tracker.setActive(2);
    expect(tracker.getActive()).toBe(2);
  });

  it('clamps active index to valid range', () => {
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    tracker.setActive(99);
    expect(tracker.getActive()).toBe(4); // max index for 5 items
    tracker.setActive(-5);
    expect(tracker.getActive()).toBe(0);
  });

  it('updates active thumbnail indicator element', () => {
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    tracker.setActive(2);
    expect($w('#galleryThumbnailIndicator').text).toBe('Image 3 of 5');
  });

  it('announces image change for screen readers', async () => {
    const { announce } = await import('public/a11yHelpers.js');
    announce.mockClear();
    const state = makeState();
    const tracker = initActiveThumbnail($w, state);
    tracker.setActive(3);
    expect(announce).toHaveBeenCalledWith($w, 'Image 4 of 5: Detail View');
  });

  it('falls back to generic announcement when no title', async () => {
    const { announce } = await import('public/a11yHelpers.js');
    announce.mockClear();
    const state = makeState({
      mediaItems: [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
      ],
    });
    const tracker = initActiveThumbnail($w, state);
    tracker.setActive(1);
    expect(announce).toHaveBeenCalledWith($w, 'Image 2 of 2');
  });

  it('returns no-op tracker when product is null', () => {
    const tracker = initActiveThumbnail($w, { product: null });
    expect(() => tracker.setActive(1)).not.toThrow();
    expect(tracker.getActive()).toBe(0);
  });

  it('returns no-op tracker when no mediaItems', () => {
    const tracker = initActiveThumbnail($w, makeState({ mediaItems: [] }));
    expect(() => tracker.setActive(1)).not.toThrow();
    expect(tracker.getActive()).toBe(0);
  });
});

// ── Gallery Config Application ───────────────────────────────────

describe('applyGalleryConfig', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
    vi.clearAllMocks();
  });

  it('applies category-specific gallery config', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 5,
      enableZoom: true,
      enableLightbox: true,
      zoomLevel: 2.5,
      autoPlayGallery: false,
      showThumbnailStrip: true,
      thumbnailPosition: 'left',
      mainImageFit: 'contain',
    });
    const state = makeState();
    const config = applyGalleryConfig($w, state);
    expect(getGalleryConfig).toHaveBeenCalledWith('futon-frames');
    expect(config.zoomLevel).toBe(2.5);
    expect(config.thumbnailPosition).toBe('left');
  });

  it('uses default config when no collections', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockClear();
    const state = makeState({ collections: undefined });
    applyGalleryConfig($w, state);
    expect(getGalleryConfig).toHaveBeenCalledWith('');
  });

  it('uses default config when collections is empty', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockClear();
    const state = makeState({ collections: [] });
    applyGalleryConfig($w, state);
    expect(getGalleryConfig).toHaveBeenCalledWith('');
  });

  it('returns config object with all expected properties', () => {
    const state = makeState();
    const config = applyGalleryConfig($w, state);
    expect(config).toHaveProperty('zoomLevel');
    expect(config).toHaveProperty('thumbnailPosition');
    expect(config).toHaveProperty('thumbnailCount');
    expect(config).toHaveProperty('enableZoom');
    expect(config).toHaveProperty('enableLightbox');
  });

  it('hides zoom elements when enableZoom is false', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 4, enableZoom: false, enableLightbox: true,
      zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: true,
      thumbnailPosition: 'bottom', mainImageFit: 'contain',
    });
    const state = makeState();
    applyGalleryConfig($w, state);
    expect($w('#imageZoomOverlay').hide).toHaveBeenCalled();
  });

  it('hides lightbox elements when enableLightbox is false', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 4, enableZoom: true, enableLightbox: false,
      zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: true,
      thumbnailPosition: 'bottom', mainImageFit: 'contain',
    });
    const state = makeState();
    applyGalleryConfig($w, state);
    expect($w('#lightboxOverlay').hide).toHaveBeenCalled();
  });

  it('hides thumbnail strip when showThumbnailStrip is false', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 4, enableZoom: true, enableLightbox: true,
      zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: false,
      thumbnailPosition: 'bottom', mainImageFit: 'contain',
    });
    const state = makeState();
    applyGalleryConfig($w, state);
    expect($w('#productGallery').hide).toHaveBeenCalled();
  });

  it('returns safe defaults when product is null', () => {
    const config = applyGalleryConfig($w, { product: null });
    expect(config).toBeDefined();
    expect(config.zoomLevel).toBeDefined();
  });
});

// ── Thumbnail Scroll ─────────────────────────────────────────────

describe('initThumbnailScroll', () => {
  let $w;

  beforeEach(() => {
    $w = create$w();
  });

  it('wires prev/next buttons for thumbnail scrolling', () => {
    const state = makeState();
    initThumbnailScroll($w, state);
    expect($w('#thumbScrollPrev').onClick).toHaveBeenCalled();
    expect($w('#thumbScrollNext').onClick).toHaveBeenCalled();
  });

  it('hides scroll buttons when images fit within thumbnail count', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 6, enableZoom: true, enableLightbox: true,
      zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: true,
      thumbnailPosition: 'bottom', mainImageFit: 'contain',
    });
    const state = makeState(); // 5 images, thumbnailCount 6
    initThumbnailScroll($w, state);
    expect($w('#thumbScrollPrev').hide).toHaveBeenCalled();
    expect($w('#thumbScrollNext').hide).toHaveBeenCalled();
  });

  it('shows scroll buttons when images exceed thumbnail count', async () => {
    const { getGalleryConfig } = await import('public/galleryConfig.js');
    getGalleryConfig.mockReturnValue({
      thumbnailCount: 3, enableZoom: true, enableLightbox: true,
      zoomLevel: 2, autoPlayGallery: false, showThumbnailStrip: true,
      thumbnailPosition: 'bottom', mainImageFit: 'contain',
    });
    const state = makeState(); // 5 images, thumbnailCount 3
    initThumbnailScroll($w, state);
    expect($w('#thumbScrollPrev').hide).not.toHaveBeenCalled();
    expect($w('#thumbScrollNext').hide).not.toHaveBeenCalled();
  });

  it('sets ARIA labels on scroll buttons', () => {
    const state = makeState();
    initThumbnailScroll($w, state);
    expect($w('#thumbScrollPrev').accessibility.ariaLabel).toContain('previous');
    expect($w('#thumbScrollNext').accessibility.ariaLabel).toContain('next');
  });

  it('returns scrollTo function', () => {
    const state = makeState();
    const scroll = initThumbnailScroll($w, state);
    expect(typeof scroll.scrollTo).toBe('function');
  });

  it('handles missing scroll elements gracefully', () => {
    const broken$w = (sel) => {
      if (sel === '#thumbScrollPrev' || sel === '#thumbScrollNext') {
        throw new TypeError('Element not found');
      }
      return $w(sel);
    };
    const state = makeState();
    expect(() => initThumbnailScroll(broken$w, state)).not.toThrow();
  });

  it('returns no-op when product is null', () => {
    const scroll = initThumbnailScroll($w, { product: null });
    expect(scroll).toBeDefined();
    expect(() => scroll.scrollTo(2)).not.toThrow();
  });

  it('returns no-op when no media items', () => {
    const state = makeState({ mediaItems: [] });
    const scroll = initThumbnailScroll($w, state);
    expect(() => scroll.scrollTo(1)).not.toThrow();
  });
});
