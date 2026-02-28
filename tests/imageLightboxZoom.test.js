import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── $w Mock Infrastructure ──────────────────────────────────────────
// initImageLightbox and initImageZoom accept $w as first parameter
// (public modules don't have access to global $w in Wix Velo).

const elements = new Map();

function createMockElement() {
  return {
    text: '',
    src: '',
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
    onItemClicked: vi.fn(),
  };
}

function getEl(sel) {
  if (!elements.has(sel)) elements.set(sel, createMockElement());
  return elements.get(sel);
}

const mock$w = (sel) => getEl(sel);

// Mock document for keyboard event registration
const keydownListeners = [];
globalThis.document = {
  addEventListener: vi.fn((event, handler) => {
    if (event === 'keydown') keydownListeners.push(handler);
  }),
};

import { initImageLightbox, initImageZoom } from '../src/public/galleryHelpers.js';

// ── Helpers ─────────────────────────────────────────────────────────

function createGallery(imageSources) {
  return {
    items: imageSources.map(src => ({ src })),
    onItemClicked: vi.fn(),
  };
}

function createMainImage(src) {
  return {
    src,
    onClick: vi.fn(),
    onMouseIn: vi.fn(),
    onMouseOut: vi.fn(),
  };
}

// ── initImageLightbox ───────────────────────────────────────────────

describe('initImageLightbox', () => {
  beforeEach(() => {
    elements.clear();
    keydownListeners.length = 0;
    globalThis.document.addEventListener.mockClear();
  });

  const galleryImages = [
    'https://example.com/futon-1.jpg',
    'https://example.com/futon-2.jpg',
    'https://example.com/futon-3.jpg',
  ];

  // ── Initialization ──────────────────────────────────────────────

  describe('initialization', () => {
    it('returns controller with open, close, handleKeydown', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      expect(lb).toHaveProperty('open');
      expect(lb).toHaveProperty('close');
      expect(lb).toHaveProperty('handleKeydown');
    });

    it('returns null when no images available', () => {
      const lb = initImageLightbox(mock$w, { items: [] }, null);
      expect(lb).toBeNull();
    });

    it('falls back to main image when gallery has no items', () => {
      const mainImg = createMainImage('https://example.com/solo.jpg');
      const lb = initImageLightbox(mock$w, { items: [] }, mainImg);
      expect(lb).not.toBeNull();
    });

    it('registers keydown listener on document', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);
      expect(globalThis.document.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });
  });

  // ── Click to open lightbox ──────────────────────────────────────

  describe('click to open (desktop click / mobile tap)', () => {
    it('opens lightbox when main image is clicked', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      const clickCb = mainImg.onClick.mock.calls[0][0];
      clickCb();

      expect(getEl('#lightboxOverlay').show).toHaveBeenCalledWith('fade', { duration: 250 });
      expect(getEl('#lightboxImage').src).toBe(galleryImages[0]);
      expect(getEl('#lightboxCounter').text).toBe('1 / 3');
    });

    it('opens at correct index when gallery thumbnail is clicked', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      const itemClickCb = gallery.onItemClicked.mock.calls[0][0];
      itemClickCb({ item: { src: galleryImages[1] } });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[1]);
      expect(getEl('#lightboxCounter').text).toBe('2 / 3');
    });

    it('defaults to index 0 if thumbnail src not found in images', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      const itemClickCb = gallery.onItemClicked.mock.calls[0][0];
      itemClickCb({ item: { src: 'https://example.com/unknown.jpg' } });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[0]);
      expect(getEl('#lightboxCounter').text).toBe('1 / 3');
    });
  });

  // ── Close lightbox ──────────────────────────────────────────────

  describe('close lightbox', () => {
    it('closes on close button click', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      // Open first
      mainImg.onClick.mock.calls[0][0]();

      // Close via button
      const closeCb = getEl('#lightboxClose').onClick.mock.calls[0][0];
      closeCb();

      expect(getEl('#lightboxOverlay').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('closes on Escape key', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);
      lb.handleKeydown({ key: 'Escape' });

      expect(getEl('#lightboxOverlay').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });

    it('programmatic close() hides overlay', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);
      lb.close();

      expect(getEl('#lightboxOverlay').hide).toHaveBeenCalledWith('fade', { duration: 200 });
    });
  });

  // ── Keyboard navigation ─────────────────────────────────────────

  describe('keyboard navigation', () => {
    it('ArrowRight advances to next image', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);
      lb.handleKeydown({ key: 'ArrowRight' });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[1]);
      expect(getEl('#lightboxCounter').text).toBe('2 / 3');
    });

    it('ArrowLeft goes to previous image', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(1);
      lb.handleKeydown({ key: 'ArrowLeft' });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[0]);
      expect(getEl('#lightboxCounter').text).toBe('1 / 3');
    });

    it('wraps from last to first image on ArrowRight', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(2);
      lb.handleKeydown({ key: 'ArrowRight' });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[0]);
      expect(getEl('#lightboxCounter').text).toBe('1 / 3');
    });

    it('wraps from first to last image on ArrowLeft', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);
      lb.handleKeydown({ key: 'ArrowLeft' });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[2]);
      expect(getEl('#lightboxCounter').text).toBe('3 / 3');
    });

    it('ignores keystrokes when lightbox is closed', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      // Don't open — just fire keys
      lb.handleKeydown({ key: 'ArrowRight' });
      lb.handleKeydown({ key: 'Escape' });

      expect(getEl('#lightboxOverlay').show).not.toHaveBeenCalled();
      expect(getEl('#lightboxOverlay').hide).not.toHaveBeenCalled();
    });

    it('keyboard events reach handler via document listener', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);

      // Simulate keydown via the document listener
      const listener = keydownListeners[keydownListeners.length - 1];
      listener({ key: 'ArrowRight' });

      expect(getEl('#lightboxImage').src).toBe(galleryImages[1]);
    });
  });

  // ── Prev / Next button controls ─────────────────────────────────

  describe('navigation button controls', () => {
    it('prev button navigates backward', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      // Open at first image
      mainImg.onClick.mock.calls[0][0]();

      // Click prev (wraps to last)
      getEl('#lightboxPrev').onClick.mock.calls[0][0]();

      expect(getEl('#lightboxImage').src).toBe(galleryImages[2]);
    });

    it('next button navigates forward', () => {
      const gallery = createGallery(galleryImages);
      const mainImg = createMainImage(galleryImages[0]);
      initImageLightbox(mock$w, gallery, mainImg);

      mainImg.onClick.mock.calls[0][0]();

      getEl('#lightboxNext').onClick.mock.calls[0][0]();

      expect(getEl('#lightboxImage').src).toBe(galleryImages[1]);
    });
  });

  // ── Single-image gallery ────────────────────────────────────────

  describe('single-image gallery', () => {
    it('hides nav controls when only one image', () => {
      const gallery = createGallery(['https://example.com/solo.jpg']);
      const mainImg = createMainImage('https://example.com/solo.jpg');
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);

      expect(getEl('#lightboxPrev').hide).toHaveBeenCalled();
      expect(getEl('#lightboxNext').hide).toHaveBeenCalled();
      expect(getEl('#lightboxCounter').hide).toHaveBeenCalled();
    });

    it('still displays the image correctly', () => {
      const gallery = createGallery(['https://example.com/solo.jpg']);
      const mainImg = createMainImage('https://example.com/solo.jpg');
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);

      expect(getEl('#lightboxImage').src).toBe('https://example.com/solo.jpg');
    });
  });

  // ── Multiple products with varying image counts ─────────────────

  describe('varying image counts (AC #7)', () => {
    it('5-image gallery — navigate and counter correct', () => {
      const images = Array.from({ length: 5 }, (_, i) => `https://example.com/img-${i}.jpg`);
      const gallery = createGallery(images);
      const mainImg = createMainImage(images[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(3);
      expect(getEl('#lightboxImage').src).toBe(images[3]);
      expect(getEl('#lightboxCounter').text).toBe('4 / 5');
    });

    it('2-image gallery — nav controls visible', () => {
      const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
      const gallery = createGallery(images);
      const mainImg = createMainImage(images[0]);
      const lb = initImageLightbox(mock$w, gallery, mainImg);

      lb.open(0);

      // For >1 images, hide should NOT be called on prev/next
      expect(getEl('#lightboxPrev').hide).not.toHaveBeenCalled();
      expect(getEl('#lightboxNext').hide).not.toHaveBeenCalled();
    });

    it('fallback-only product (no gallery items)', () => {
      const mainImg = createMainImage('https://example.com/fallback.jpg');
      const lb = initImageLightbox(mock$w, { items: [] }, mainImg);

      lb.open(0);
      expect(getEl('#lightboxImage').src).toBe('https://example.com/fallback.jpg');
      expect(getEl('#lightboxCounter').text).toBe('1 / 1');
    });
  });
});

// ── initImageZoom ───────────────────────────────────────────────────

describe('initImageZoom', () => {
  beforeEach(() => {
    elements.clear();
  });

  // ── Initialization ──────────────────────────────────────────────

  describe('initialization', () => {
    it('returns controller with show, hide, zoomFactor', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      const zoom = initImageZoom(mock$w, img);

      expect(zoom).toHaveProperty('show');
      expect(zoom).toHaveProperty('hide');
      expect(zoom.zoomFactor).toBe(2);
    });

    it('returns null for null element', () => {
      expect(initImageZoom(mock$w, null)).toBeNull();
    });

    it('accepts custom zoom factor', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      const zoom = initImageZoom(mock$w, img, 3);
      expect(zoom.zoomFactor).toBe(3);
    });

    it('registers onMouseIn and onMouseOut handlers', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      initImageZoom(mock$w, img);

      expect(img.onMouseIn).toHaveBeenCalledWith(expect.any(Function));
      expect(img.onMouseOut).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ── Desktop hover zoom ──────────────────────────────────────────

  describe('desktop hover zoom', () => {
    it('shows zoom overlay on mouse enter', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      initImageZoom(mock$w, img);

      const mouseInCb = img.onMouseIn.mock.calls[0][0];
      mouseInCb();

      expect(getEl('#imageZoomImage').src).toBe('https://example.com/futon.jpg');
      expect(getEl('#imageZoomOverlay').show).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('hides zoom overlay on mouse leave', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      initImageZoom(mock$w, img);

      const mouseOutCb = img.onMouseOut.mock.calls[0][0];
      mouseOutCb();

      expect(getEl('#imageZoomOverlay').hide).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('uses current image src at hover time (tracks gallery navigation)', () => {
      const img = createMainImage('https://example.com/futon-1.jpg');
      initImageZoom(mock$w, img);

      // Simulate gallery navigation changing the src
      img.src = 'https://example.com/futon-2.jpg';

      const mouseInCb = img.onMouseIn.mock.calls[0][0];
      mouseInCb();

      expect(getEl('#imageZoomImage').src).toBe('https://example.com/futon-2.jpg');
    });
  });

  // ── Programmatic control ────────────────────────────────────────

  describe('programmatic control', () => {
    it('show() triggers zoom overlay', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      const zoom = initImageZoom(mock$w, img);

      zoom.show();

      expect(getEl('#imageZoomOverlay').show).toHaveBeenCalledWith('fade', { duration: 150 });
    });

    it('hide() closes zoom overlay', () => {
      const img = createMainImage('https://example.com/futon.jpg');
      const zoom = initImageZoom(mock$w, img);

      zoom.hide();

      expect(getEl('#imageZoomOverlay').hide).toHaveBeenCalledWith('fade', { duration: 150 });
    });
  });

  // ── Multiple products ───────────────────────────────────────────

  describe('multiple products (AC #7)', () => {
    const productImages = [
      'https://example.com/futon-frame.jpg',
      'https://example.com/murphy-bed.jpg',
      'https://example.com/mattress.jpg',
    ];

    productImages.forEach((imgSrc) => {
      it(`zoom works for ${imgSrc.split('/').pop()}`, () => {
        elements.clear();
        const img = createMainImage(imgSrc);
        initImageZoom(mock$w, img);

        const mouseInCb = img.onMouseIn.mock.calls[0][0];
        mouseInCb();

        expect(getEl('#imageZoomImage').src).toBe(imgSrc);
        expect(getEl('#imageZoomOverlay').show).toHaveBeenCalled();
      });
    });
  });
});
