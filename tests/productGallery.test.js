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

import { initImageGallery, initProductBadge, initProductVideo } from '../src/public/ProductGallery.js';

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
  });
});
