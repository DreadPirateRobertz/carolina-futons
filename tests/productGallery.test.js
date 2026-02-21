import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  initImageLightbox: vi.fn(),
  initImageZoom: vi.fn(),
}));

vi.mock('public/placeholderImages.js', () => ({
  getProductFallbackImage: vi.fn(() => 'https://example.com/placeholder.jpg'),
  getPlaceholderProductImages: vi.fn(() => ['https://example.com/p1.jpg', 'https://example.com/p2.jpg', 'https://example.com/p3.jpg', 'https://example.com/p4.jpg']),
}));

vi.mock('public/touchHelpers', () => ({ enableSwipe: vi.fn() }));
vi.mock('public/engagementTracker', () => ({
  trackProductPageView: vi.fn(), trackCartAdd: vi.fn(), trackGalleryInteraction: vi.fn(), trackSwatchView: vi.fn(), trackSocialShare: vi.fn(),
}));

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
