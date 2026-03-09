import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { futonFrame } from './fixtures/products.js';

vi.mock('backend/seoHelpers.web', () => ({
  getProductSchema: vi.fn(),
  generateAltText: vi.fn().mockResolvedValue('Eureka Futon Frame - Night & Day - Carolina Futons'),
  getBreadcrumbSchema: vi.fn(),
  getProductOgTags: vi.fn(),
  getProductFaqSchema: vi.fn(),
}));

vi.mock('public/galleryHelpers.js', () => ({
  trackProductView: vi.fn(),
  getRecentlyViewed: vi.fn(() => []),
  getProductBadge: vi.fn((p) => p?.ribbon || null),
  initImageLightbox: vi.fn(() => ({ destroy: vi.fn(), open: vi.fn(), close: vi.fn() })),
  initImageZoom: vi.fn(),
}));

vi.mock('public/galleryConfig.js', () => ({
  getImageDimensions: vi.fn(() => ({ width: 800, height: 800 })),
  getGalleryConfig: vi.fn(() => ({})),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'https://example.com/placeholder.jpg'),
  getPlaceholderProductImages: vi.fn(() => ['https://example.com/p1.jpg', 'https://example.com/p2.jpg', 'https://example.com/p3.jpg', 'https://example.com/p4.jpg']),
}));

vi.mock('public/touchHelpers', () => ({ enableSwipe: vi.fn() }));
vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(), trackCartAdd: vi.fn(), trackGalleryInteraction: vi.fn(), trackSwatchView: vi.fn(), trackSocialShare: vi.fn(),
}));
vi.mock('public/a11yHelpers.js', () => ({ announce: vi.fn() }));

import { initImageGallery, initProductBadge, initProductVideo, preloadGalleryThumbnails } from '../src/public/ProductGallery.js';

function createMockElement() {
  return {
    text: '', src: '', alt: '', value: '', label: '', items: [],
    style: { color: '', backgroundColor: '', borderColor: '', borderWidth: '', opacity: 0 },
    show: vi.fn(() => Promise.resolve()), hide: vi.fn(() => Promise.resolve()),
    collapse: vi.fn(), expand: vi.fn(), onClick: vi.fn(), onChange: vi.fn(),
    onItemReady: vi.fn(), onItemClicked: vi.fn(), mute: vi.fn(),
    getElement: vi.fn(() => null),
    accessibility: {},
  };
}

function create$w() {
  const els = new Map();
  return (sel) => { if (!els.has(sel)) els.set(sel, createMockElement()); return els.get(sel); };
}

describe('ProductGallery', () => {
  let $w, state;
  beforeEach(() => {
    $w = create$w();
    state = { product: { ...futonFrame, collections: ['futon-frames'] }, selectedSwatchId: null };
  });

  describe('initImageGallery', () => {
    it('registers onItemClicked on the gallery', () => {
      initImageGallery($w, state);
      expect($w('#productGallery').onItemClicked).toHaveBeenCalled();
    });

    it('gallery click updates main image src', () => {
      initImageGallery($w, state);
      const cb = $w('#productGallery').onItemClicked.mock.calls[0][0];
      cb({ item: { src: 'https://example.com/new.jpg' } });
      expect($w('#productMainImage').src).toBe('https://example.com/new.jpg');
    });

    it('calls initImageLightbox and initImageZoom', async () => {
      const { initImageLightbox, initImageZoom } = await import('public/galleryHelpers.js');
      initImageGallery($w, state);
      expect(initImageLightbox).toHaveBeenCalled();
      expect(initImageZoom).toHaveBeenCalled();
    });

    it('fills gallery with placeholders when few media items', () => {
      state.product.mediaItems = [];
      initImageGallery($w, state);
      const gallery = $w('#productGallery');
      expect(gallery.items.length).toBeGreaterThan(0);
    });

    it('returns early when state.product is null', async () => {
      const { initImageLightbox, initImageZoom } = await import('public/galleryHelpers.js');
      initImageLightbox.mockClear();
      initImageZoom.mockClear();
      state.product = null;
      initImageGallery($w, state);
      expect(initImageLightbox).not.toHaveBeenCalled();
      expect(initImageZoom).not.toHaveBeenCalled();
    });

    it('returns early when state.product is undefined', async () => {
      const { initImageLightbox } = await import('public/galleryHelpers.js');
      initImageLightbox.mockClear();
      state.product = undefined;
      initImageGallery($w, state);
      expect(initImageLightbox).not.toHaveBeenCalled();
    });

    it('sets fallback image when product has no mainMedia', async () => {
      const { getProductFallbackImage } = await import('public/placeholderImages.js');
      getProductFallbackImage.mockClear();
      state.product.mainMedia = null;
      initImageGallery($w, state);
      expect(getProductFallbackImage).toHaveBeenCalledWith('futon-frames');
      expect($w('#productMainImage').src).toBe('https://example.com/placeholder.jpg');
    });

    it('does not set fallback when product has mainMedia', async () => {
      const { getProductFallbackImage } = await import('public/placeholderImages.js');
      getProductFallbackImage.mockClear();
      state.product.mainMedia = 'https://example.com/real-image.jpg';
      initImageGallery($w, state);
      expect(getProductFallbackImage).not.toHaveBeenCalled();
    });

    it('passes empty string as category when no collections', async () => {
      const { getProductFallbackImage } = await import('public/placeholderImages.js');
      getProductFallbackImage.mockClear();
      state.product.mainMedia = null;
      state.product.collections = undefined;
      initImageGallery($w, state);
      expect(getProductFallbackImage).toHaveBeenCalledWith('');
    });

    it('calls generateAltText with product and main tag', async () => {
      const { generateAltText } = await import('backend/seoHelpers.web');
      generateAltText.mockClear();
      initImageGallery($w, state);
      expect(generateAltText).toHaveBeenCalledWith(state.product, 'main');
    });

    it('sets alt text on main image after generateAltText resolves', async () => {
      const { generateAltText } = await import('backend/seoHelpers.web');
      generateAltText.mockResolvedValue('Custom Alt Text');
      initImageGallery($w, state);
      // Wait for the promise to resolve
      await new Promise(r => setTimeout(r, 10));
      expect($w('#productMainImage').alt).toBe('Custom Alt Text');
    });

    it('skips placeholder fill when product has 3+ media items', async () => {
      const { getPlaceholderProductImages } = await import('public/placeholderImages.js');
      getPlaceholderProductImages.mockClear();
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
        { src: 'https://example.com/c.jpg', type: 'image' },
      ];
      initImageGallery($w, state);
      expect(getPlaceholderProductImages).not.toHaveBeenCalled();
    });

    it('skips placeholder fill when product has exactly 3 media items', async () => {
      const { getPlaceholderProductImages } = await import('public/placeholderImages.js');
      getPlaceholderProductImages.mockClear();
      state.product.mediaItems = [
        { src: 'https://example.com/1.jpg', type: 'image' },
        { src: 'https://example.com/2.jpg', type: 'image' },
        { src: 'https://example.com/3.jpg', type: 'image' },
      ];
      initImageGallery($w, state);
      expect(getPlaceholderProductImages).not.toHaveBeenCalled();
    });

    it('fills placeholders when product has 2 media items and preserves existing', () => {
      state.product.mediaItems = [
        { src: 'https://example.com/existing1.jpg', type: 'image' },
        { src: 'https://example.com/existing2.jpg', type: 'image' },
      ];
      initImageGallery($w, state);
      const gallery = $w('#productGallery');
      expect(gallery.items[0].src).toBe('https://example.com/existing1.jpg');
      expect(gallery.items[1].src).toBe('https://example.com/existing2.jpg');
      // Remaining items are placeholders
      expect(gallery.items.length).toBeGreaterThan(2);
    });

    it('calls enableSwipe when gallery element exists', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      enableSwipe.mockClear();
      // Make getElement return a truthy element so enableSwipe gets called
      const gallery = $w('#productGallery');
      gallery.getElement = vi.fn(() => ({}));
      initImageGallery($w, state);
      expect(enableSwipe).toHaveBeenCalled();
      expect(enableSwipe.mock.calls[0][2]).toEqual({ threshold: 40 });
    });

    it('does not call enableSwipe when gallery element is null', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      enableSwipe.mockClear();
      // getElement returns null by default in mock
      initImageGallery($w, state);
      expect(enableSwipe).not.toHaveBeenCalled();
    });

    it('swipe left advances to next image and tracks interaction', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      const { trackGalleryInteraction } = await import('public/engagementTracker');
      enableSwipe.mockClear();
      trackGalleryInteraction.mockClear();
      const gallery = $w('#productGallery');
      gallery.getElement = vi.fn(() => ({}));
      gallery.items = [
        { src: 'https://example.com/img0.jpg' },
        { src: 'https://example.com/img1.jpg' },
        { src: 'https://example.com/img2.jpg' },
      ];
      state.product.mediaItems = gallery.items.map(i => ({ ...i, type: 'image' }));
      initImageGallery($w, state);
      const swipeCallback = enableSwipe.mock.calls[0][1];
      swipeCallback('left');
      expect($w('#productMainImage').src).toBe('https://example.com/img1.jpg');
      expect(trackGalleryInteraction).toHaveBeenCalledWith('swipe', 'left');
    });

    it('swipe right does not go below index 0', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      enableSwipe.mockClear();
      const gallery = $w('#productGallery');
      gallery.getElement = vi.fn(() => ({}));
      gallery.items = [
        { src: 'https://example.com/first.jpg' },
        { src: 'https://example.com/second.jpg' },
      ];
      state.product.mediaItems = gallery.items.map(i => ({ ...i, type: 'image' }));
      initImageGallery($w, state);
      const swipeCallback = enableSwipe.mock.calls[0][1];
      // Already at index 0, swipe right should stay at 0
      swipeCallback('right');
      expect($w('#productMainImage').src).toBe('https://example.com/first.jpg');
    });

    it('swipe callback handles empty items array gracefully', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      enableSwipe.mockClear();
      const gallery = $w('#productGallery');
      gallery.getElement = vi.fn(() => ({}));
      gallery.items = [];
      initImageGallery($w, state);
      const swipeCallback = enableSwipe.mock.calls[0][1];
      // Should not throw
      expect(() => swipeCallback('left')).not.toThrow();
    });

    it('swipe left does not exceed max index', async () => {
      const { enableSwipe } = await import('public/touchHelpers');
      enableSwipe.mockClear();
      const gallery = $w('#productGallery');
      gallery.getElement = vi.fn(() => ({}));
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
        { src: 'https://example.com/c.jpg', type: 'image' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const swipeCallback = enableSwipe.mock.calls[0][1];
      swipeCallback('left'); // idx → 1
      swipeCallback('left'); // idx → 2
      swipeCallback('left'); // idx should stay at 2 (max)
      expect($w('#productMainImage').src).toBe('https://example.com/c.jpg');
    });

    it('gallery click uses item.title for alt text', () => {
      initImageGallery($w, state);
      const cb = $w('#productGallery').onItemClicked.mock.calls[0][0];
      cb({ item: { src: 'https://example.com/new.jpg', title: 'Oak Frame Side View' } });
      expect($w('#productMainImage').alt).toBe('Oak Frame Side View');
    });

    it('gallery click falls back to product.name for alt text when no item.title', () => {
      initImageGallery($w, state);
      const cb = $w('#productGallery').onItemClicked.mock.calls[0][0];
      cb({ item: { src: 'https://example.com/new.jpg' } });
      expect($w('#productMainImage').alt).toBe('Eureka Futon Frame');
    });

    it('gallery click falls back to generic alt when no title or product name', () => {
      state.product.name = undefined;
      initImageGallery($w, state);
      const cb = $w('#productGallery').onItemClicked.mock.calls[0][0];
      cb({ item: { src: 'https://example.com/new.jpg' } });
      expect($w('#productMainImage').alt).toBe('Product image');
    });

    it('placeholder items include product name as title', () => {
      state.product.mediaItems = [];
      initImageGallery($w, state);
      const gallery = $w('#productGallery');
      const placeholderItem = gallery.items.find(i => i.src.includes('p1.jpg'));
      expect(placeholderItem.title).toBe('Eureka Futon Frame');
      expect(placeholderItem.type).toBe('image');
    });

    it('passes gallery and main image elements to initImageLightbox', async () => {
      const { initImageLightbox } = await import('public/galleryHelpers.js');
      initImageLightbox.mockClear();
      initImageGallery($w, state);
      expect(initImageLightbox).toHaveBeenCalledWith(
        $w,
        $w('#productGallery'),
        $w('#productMainImage'),
      );
    });

    it('passes main image element to initImageZoom', async () => {
      const { initImageZoom } = await import('public/galleryHelpers.js');
      initImageZoom.mockClear();
      initImageGallery($w, state);
      expect(initImageZoom).toHaveBeenCalledWith($w, $w('#productMainImage'));
    });

    it('returns object with destroy function', () => {
      const result = initImageGallery($w, state);
      expect(result).toHaveProperty('destroy');
      expect(typeof result.destroy).toBe('function');
    });

    it('returns destroy no-op when product is null', () => {
      state.product = null;
      const result = initImageGallery($w, state);
      expect(result).toHaveProperty('destroy');
      expect(() => result.destroy()).not.toThrow();
    });
  });

  describe('initImageGallery — CLS prevention', () => {
    it('sets main image width to 100%', async () => {
      initImageGallery($w, state);
      expect($w('#productMainImage').style.width).toBe('100%');
    });

    it('sets aspect ratio from getImageDimensions', async () => {
      const { getImageDimensions } = await import('public/galleryConfig.js');
      getImageDimensions.mockReturnValue({ width: 800, height: 800 });
      initImageGallery($w, state);
      expect(getImageDimensions).toHaveBeenCalledWith('productPageMain');
      expect($w('#productMainImage').style.aspectRatio).toBe('800 / 800');
    });

    it('does not crash when style is not settable', async () => {
      const mainImage = $w('#productMainImage');
      Object.defineProperty(mainImage, 'style', {
        get() { throw new Error('style not available'); },
      });
      expect(() => initImageGallery($w, state)).not.toThrow();
    });
  });

  describe('initImageGallery — ARIA attributes', () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sets ariaLabel on main image for carousel', () => {
      vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      });
      initImageGallery($w, state);
      expect($w('#productMainImage').accessibility.ariaLabel).toBe(
        'Product image gallery, use arrow keys to navigate',
      );
    });

    it('sets ariaRoledescription to carousel', () => {
      vi.stubGlobal('document', {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        activeElement: null,
      });
      initImageGallery($w, state);
      expect($w('#productMainImage').accessibility.ariaRoledescription).toBe('carousel');
    });
  });

  describe('initImageGallery — keyboard navigation', () => {
    let keydownListeners;

    beforeEach(() => {
      keydownListeners = [];
      vi.stubGlobal('document', {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'keydown') keydownListeners.push(handler);
        }),
        removeEventListener: vi.fn((event, handler) => {
          if (event === 'keydown') {
            keydownListeners = keydownListeners.filter(h => h !== handler);
          }
        }),
        activeElement: { id: 'productMainImage', closest: vi.fn(() => true) },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('registers keydown listener on document', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'Image A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'Image B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'Image C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('ArrowRight advances to next image', async () => {
      const { trackGalleryInteraction } = await import('public/engagementTracker');
      trackGalleryInteraction.mockClear();
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'Image A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'Image B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'Image C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/b.jpg');
      expect(trackGalleryInteraction).toHaveBeenCalledWith('keyboard', 'next');
    });

    it('ArrowDown advances to next image', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowDown', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/b.jpg');
    });

    it('ArrowLeft goes to previous image', async () => {
      const { trackGalleryInteraction } = await import('public/engagementTracker');
      trackGalleryInteraction.mockClear();
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      // Go forward first
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      trackGalleryInteraction.mockClear();
      // Go back
      handler({ key: 'ArrowLeft', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/b.jpg');
      expect(trackGalleryInteraction).toHaveBeenCalledWith('keyboard', 'prev');
    });

    it('ArrowUp goes to previous image', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      handler({ key: 'ArrowUp', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/a.jpg');
    });

    it('does not go below index 0 on ArrowLeft', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowLeft', preventDefault: vi.fn() });
      expect($w('#productMainImage').src).toBe('https://example.com/a.jpg');
    });

    it('does not exceed max index on ArrowRight', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      handler({ key: 'ArrowRight', preventDefault: vi.fn() }); // should stay at 2
      expect($w('#productMainImage').src).toBe('https://example.com/c.jpg');
    });

    it('calls preventDefault on arrow key events', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      const event = { key: 'ArrowRight', preventDefault: vi.fn() };
      handler(event);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('announces image position via a11y helper', async () => {
      const { announce } = await import('public/a11yHelpers.js');
      announce.mockClear();
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect(announce).toHaveBeenCalledWith($w, 'Image 2 of 3');
    });

    it('sets alt text from item.title on keyboard nav', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'Front View' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'Side View' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'Back View' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect($w('#productMainImage').alt).toBe('Side View');
    });

    it('falls back to product.name for alt when item has no title', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
        { src: 'https://example.com/c.jpg', type: 'image' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      expect($w('#productMainImage').alt).toBe('Eureka Futon Frame');
    });

    it('ignores non-arrow keys', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      const event = { key: 'Enter', preventDefault: vi.fn() };
      handler(event);
      // Should not navigate — preventDefault should NOT be called
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('ignores arrow keys when gallery is not focused', () => {
      // Set activeElement to something outside the gallery
      document.activeElement = { id: 'someOtherElement', closest: vi.fn(() => null) };
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      initImageGallery($w, state);
      const handler = keydownListeners[0];
      const prevSrc = $w('#productMainImage').src;
      handler({ key: 'ArrowRight', preventDefault: vi.fn() });
      // src should not have changed
      expect($w('#productMainImage').src).toBe(prevSrc);
    });

    it('handles empty items array on keyboard nav without crashing', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
        { src: 'https://example.com/c.jpg', type: 'image' },
      ];
      // Set items to empty after init to test runtime behavior
      initImageGallery($w, state);
      gallery.items = [];
      const handler = keydownListeners[0];
      expect(() => handler({ key: 'ArrowRight', preventDefault: vi.fn() })).not.toThrow();
    });
  });

  describe('initImageGallery — destroy cleanup', () => {
    let keydownListeners;

    beforeEach(() => {
      keydownListeners = [];
      vi.stubGlobal('document', {
        addEventListener: vi.fn((event, handler) => {
          if (event === 'keydown') keydownListeners.push(handler);
        }),
        removeEventListener: vi.fn((event, handler) => {
          if (event === 'keydown') {
            keydownListeners = keydownListeners.filter(h => h !== handler);
          }
        }),
        activeElement: { id: 'productMainImage', closest: vi.fn(() => true) },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('destroy removes keydown event listener', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image' },
        { src: 'https://example.com/b.jpg', type: 'image' },
        { src: 'https://example.com/c.jpg', type: 'image' },
      ];
      gallery.items = state.product.mediaItems;
      const result = initImageGallery($w, state);
      result.destroy();
      expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });

    it('destroy calls lightbox.destroy', async () => {
      const { initImageLightbox } = await import('public/galleryHelpers.js');
      const mockLightboxDestroy = vi.fn();
      initImageLightbox.mockReturnValue({ destroy: mockLightboxDestroy, open: vi.fn(), close: vi.fn() });
      const result = initImageGallery($w, state);
      result.destroy();
      expect(mockLightboxDestroy).toHaveBeenCalled();
    });

    it('destroy can be called multiple times without error', () => {
      const result = initImageGallery($w, state);
      expect(() => {
        result.destroy();
        result.destroy();
      }).not.toThrow();
    });

    it('keyboard handler no longer fires after destroy', () => {
      const gallery = $w('#productGallery');
      state.product.mediaItems = [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'C' },
      ];
      gallery.items = state.product.mediaItems;
      const result = initImageGallery($w, state);
      const handler = keydownListeners[0];
      result.destroy();
      // After destroy, the handler was removed — keydownListeners should be empty
      expect(keydownListeners.length).toBe(0);
    });
  });

  describe('initProductBadge', () => {
    it('shows badge when product has ribbon', () => {
      state.product.ribbon = 'Sale';
      initProductBadge($w, state);
      expect($w('#productBadgeOverlay').text).toBe('Sale');
      expect($w('#productBadgeOverlay').show).toHaveBeenCalled();
    });

    it('hides badge when no ribbon', () => {
      state.product.ribbon = '';
      initProductBadge($w, state);
      expect($w('#productBadgeOverlay').hide).toHaveBeenCalled();
    });

    it('does not crash when state.product is null', () => {
      state.product = null;
      expect(() => initProductBadge($w, state)).not.toThrow();
    });

    it('does not crash when state.product is undefined', () => {
      state.product = undefined;
      expect(() => initProductBadge($w, state)).not.toThrow();
    });

    it('shows badge with "Clearance" text', () => {
      state.product.ribbon = 'Clearance';
      initProductBadge($w, state);
      expect($w('#productBadgeOverlay').text).toBe('Clearance');
      expect($w('#productBadgeOverlay').show).toHaveBeenCalled();
    });

    it('shows badge with "New Arrival" text', () => {
      state.product.ribbon = 'New Arrival';
      initProductBadge($w, state);
      expect($w('#productBadgeOverlay').text).toBe('New Arrival');
      expect($w('#productBadgeOverlay').show).toHaveBeenCalled();
    });

    it('shows badge with "Featured" text', () => {
      state.product.ribbon = 'Featured';
      initProductBadge($w, state);
      expect($w('#productBadgeOverlay').text).toBe('Featured');
      expect($w('#productBadgeOverlay').show).toHaveBeenCalled();
    });
  });

  describe('initProductVideo', () => {
    it('collapses video section when no video media', () => {
      state.product.mediaItems = [];
      initProductVideo($w, state);
      expect($w('#productVideoSection').collapse).toHaveBeenCalled();
    });

    it('expands video section and sets source when video exists', () => {
      state.product.mediaItems = [{ mediaType: 'video', src: 'https://example.com/video.mp4' }];
      initProductVideo($w, state);
      expect($w('#productVideoSection').expand).toHaveBeenCalled();
      expect($w('#productVideo').src).toBe('https://example.com/video.mp4');
    });

    it('mutes video by default', () => {
      state.product.mediaItems = [{ type: 'video', src: 'https://example.com/v.mp4' }];
      initProductVideo($w, state);
      expect($w('#productVideo').mute).toHaveBeenCalled();
    });

    it('uses video.url when video.src is not available', () => {
      state.product.mediaItems = [{ mediaType: 'video', url: 'https://example.com/video-url.mp4' }];
      initProductVideo($w, state);
      expect($w('#productVideo').src).toBe('https://example.com/video-url.mp4');
    });

    it('prefers video.src over video.url when both are present', () => {
      state.product.mediaItems = [{ type: 'video', src: 'https://example.com/src.mp4', url: 'https://example.com/url.mp4' }];
      initProductVideo($w, state);
      expect($w('#productVideo').src).toBe('https://example.com/src.mp4');
    });

    it('sets video title text to "See It In Action"', () => {
      state.product.mediaItems = [{ type: 'video', src: 'https://example.com/v.mp4' }];
      initProductVideo($w, state);
      expect($w('#productVideoTitle').text).toBe('See It In Action');
    });

    it('registers onClick handler on viewAllVideosLink', () => {
      state.product.mediaItems = [{ type: 'video', src: 'https://example.com/v.mp4' }];
      initProductVideo($w, state);
      expect($w('#viewAllVideosLink').onClick).toHaveBeenCalled();
    });

    it('returns early without crashing when state.product is null', () => {
      state.product = null;
      expect(() => initProductVideo($w, state)).not.toThrow();
      expect($w('#productVideoSection').expand).not.toHaveBeenCalled();
      expect($w('#productVideoSection').collapse).not.toHaveBeenCalled();
    });

    it('returns early without crashing when state.product is undefined', () => {
      state.product = undefined;
      expect(() => initProductVideo($w, state)).not.toThrow();
    });

    it('detects video by mediaType "video"', () => {
      state.product.mediaItems = [
        { mediaType: 'image', src: 'https://example.com/img.jpg' },
        { mediaType: 'video', src: 'https://example.com/vid.mp4' },
      ];
      initProductVideo($w, state);
      expect($w('#productVideo').src).toBe('https://example.com/vid.mp4');
      expect($w('#productVideoSection').expand).toHaveBeenCalled();
    });

    it('detects video by type "video"', () => {
      state.product.mediaItems = [
        { type: 'image', src: 'https://example.com/img.jpg' },
        { type: 'video', src: 'https://example.com/vid2.mp4' },
      ];
      initProductVideo($w, state);
      expect($w('#productVideo').src).toBe('https://example.com/vid2.mp4');
    });

    it('collapses section when mediaItems has only images', () => {
      state.product.mediaItems = [
        { type: 'image', src: 'https://example.com/a.jpg' },
        { type: 'image', src: 'https://example.com/b.jpg' },
      ];
      initProductVideo($w, state);
      expect($w('#productVideoSection').collapse).toHaveBeenCalled();
      expect($w('#productVideoSection').expand).not.toHaveBeenCalled();
    });

    it('handles missing mediaItems array gracefully', () => {
      state.product.mediaItems = undefined;
      initProductVideo($w, state);
      expect($w('#productVideoSection').collapse).toHaveBeenCalled();
    });
  });

  describe('preloadGalleryThumbnails', () => {
    it('is a no-op that returns undefined', () => {
      const result = preloadGalleryThumbnails();
      expect(result).toBeUndefined();
    });

    it('does not throw when called with no arguments', () => {
      expect(() => preloadGalleryThumbnails()).not.toThrow();
    });
  });
});
