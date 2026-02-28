import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// CF-wy0m: Memory leak tests — event listener cleanup
//
// Tests verify that init functions return cleanup/destroy methods
// and that event listeners can be properly removed on SPA navigation.
// ═══════════════════════════════════════════════════════════════════

// ── Shared listener tracker ────────────────────────────────────────

let docListeners, winListeners;
let origDocAdd, origDocRemove, origWinAdd, origWinRemove;

beforeEach(() => {
  docListeners = [];
  winListeners = [];

  // Ensure document exists
  if (typeof globalThis.document === 'undefined') {
    globalThis.document = {};
  }
  if (typeof globalThis.window === 'undefined') {
    globalThis.window = {
      innerWidth: 1200,
      location: { pathname: '/' },
      matchMedia: () => ({ matches: false }),
    };
  }

  // Wrap addEventListener/removeEventListener to track calls
  origDocAdd = globalThis.document.addEventListener;
  origDocRemove = globalThis.document.removeEventListener;
  origWinAdd = globalThis.window.addEventListener;
  origWinRemove = globalThis.window.removeEventListener;

  globalThis.document.addEventListener = vi.fn((type, handler, opts) => {
    docListeners.push({ type, handler });
  });
  globalThis.document.removeEventListener = vi.fn((type, handler) => {
    docListeners = docListeners.filter(l => !(l.type === type && l.handler === handler));
  });
  globalThis.window.addEventListener = vi.fn((type, handler, opts) => {
    winListeners.push({ type, handler });
  });
  globalThis.window.removeEventListener = vi.fn((type, handler) => {
    winListeners = winListeners.filter(l => !(l.type === type && l.handler === handler));
  });

  // document.activeElement needed by ProductGallery
  globalThis.document.activeElement = null;
  globalThis.document.visibilityState = 'visible';
});

afterEach(() => {
  // Restore originals if they existed
  if (origDocAdd) globalThis.document.addEventListener = origDocAdd;
  if (origDocRemove) globalThis.document.removeEventListener = origDocRemove;
  if (origWinAdd) globalThis.window.addEventListener = origWinAdd;
  if (origWinRemove) globalThis.window.removeEventListener = origWinRemove;
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════
// 1. galleryHelpers: initImageLightbox cleanup
// ═══════════════════════════════════════════════════════════════════

describe('galleryHelpers: initImageLightbox returns cleanup', () => {
  it('returns a destroy function that removes keydown listener', async () => {
    const { initImageLightbox } = await import('../src/public/galleryHelpers.js');

    const mockGallery = {
      items: [{ src: 'img1.jpg' }, { src: 'img2.jpg' }],
      onItemClicked: vi.fn(),
    };
    const mockMainImage = { src: 'img1.jpg', onClick: vi.fn() };

    const result = initImageLightbox(mockGallery, mockMainImage);

    expect(result).not.toBeNull();
    expect(typeof result.destroy).toBe('function');

    // A keydown listener should have been added
    const keydownsBefore = docListeners.filter(l => l.type === 'keydown');
    expect(keydownsBefore.length).toBeGreaterThan(0);

    // After destroy, the keydown listener should be removed
    result.destroy();
    const keydownsAfter = docListeners.filter(l => l.type === 'keydown');
    expect(keydownsAfter.length).toBe(0);
  });

  it('destroy is safe to call multiple times', async () => {
    const { initImageLightbox } = await import('../src/public/galleryHelpers.js');

    const mockGallery = {
      items: [{ src: 'img1.jpg' }],
      onItemClicked: vi.fn(),
    };
    const mockMainImage = { src: 'img1.jpg', onClick: vi.fn() };

    const result = initImageLightbox(mockGallery, mockMainImage);
    expect(() => {
      result.destroy();
      result.destroy();
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. galleryHelpers: browse tracking cleanup
// ═══════════════════════════════════════════════════════════════════

describe('galleryHelpers: browse tracking cleanup', () => {
  it('cleanupBrowseTracking removes window/document listeners', async () => {
    const { trackProductView, cleanupBrowseTracking } = await import('../src/public/galleryHelpers.js');

    // Trigger browse tracking
    trackProductView({ _id: 'prod-leak-1', name: 'Test', slug: 'test', formattedPrice: '$100', mainMedia: '' });

    // Should have added listeners (scroll, beforeunload on window; visibilitychange on document)
    const hasBeforeunload = winListeners.some(l => l.type === 'beforeunload');
    const hasVischange = docListeners.some(l => l.type === 'visibilitychange');
    expect(hasBeforeunload || hasVischange).toBe(true);

    // Cleanup should remove them
    cleanupBrowseTracking();

    const scrollAfter = winListeners.filter(l => l.type === 'scroll');
    const beforeunloadAfter = winListeners.filter(l => l.type === 'beforeunload');
    const vischangeAfter = docListeners.filter(l => l.type === 'visibilitychange');
    expect(scrollAfter.length).toBe(0);
    expect(beforeunloadAfter.length).toBe(0);
    expect(vischangeAfter.length).toBe(0);
  });

  it('cleanupBrowseTracking is safe when no tracking active', async () => {
    const { cleanupBrowseTracking } = await import('../src/public/galleryHelpers.js');
    // Call cleanup first to clear any prior state
    cleanupBrowseTracking();
    // Call again — should not throw
    expect(() => cleanupBrowseTracking()).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. socialProofToast: cleanup export
// ═══════════════════════════════════════════════════════════════════

describe('socialProofToast: cleanup', () => {
  it('exports a cleanupToast function', async () => {
    const mod = await import('../src/public/socialProofToast.js');
    expect(typeof mod.cleanupToast).toBe('function');
  });

  it('cleanupToast is safe to call multiple times', async () => {
    const { cleanupToast } = await import('../src/public/socialProofToast.js');
    expect(() => {
      cleanupToast();
      cleanupToast();
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. LiveChat: Escape key listener cleanup
// ═══════════════════════════════════════════════════════════════════

describe('LiveChat: event listener cleanup', () => {
  it('exports a cleanupLiveChat function', async () => {
    const mod = await import('../src/public/LiveChat.js');
    expect(typeof mod.cleanupLiveChat).toBe('function');
  });

  it('cleanupLiveChat is safe to call multiple times', async () => {
    const { cleanupLiveChat } = await import('../src/public/LiveChat.js');
    expect(() => {
      cleanupLiveChat();
      cleanupLiveChat();
    }).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. ProductGallery: keyboard handler cleanup
// ═══════════════════════════════════════════════════════════════════

describe('ProductGallery: keyboard handler cleanup', () => {
  it('initImageGallery returns object with destroy function', async () => {
    const { initImageGallery } = await import('../src/public/ProductGallery.js');

    const mockElement = (overrides = {}) => ({
      show: vi.fn(), hide: vi.fn(), collapse: vi.fn(), expand: vi.fn(),
      text: '', src: '', alt: '', accessibility: {},
      onClick: vi.fn(), onMouseIn: vi.fn(), onMouseOut: vi.fn(),
      onItemClicked: vi.fn(), onKeyPress: vi.fn(),
      items: [], getElement: () => null,
      ...overrides,
    });

    const elements = {
      '#productMainImage': mockElement({ src: 'img1.jpg' }),
      '#productGallery': mockElement({ items: [{ src: 'img1.jpg' }] }),
      '#lightboxOverlay': mockElement(),
      '#lightboxImage': mockElement(),
      '#lightboxCounter': mockElement(),
      '#lightboxPrev': mockElement(),
      '#lightboxNext': mockElement(),
      '#lightboxClose': mockElement(),
      '#imageZoomOverlay': mockElement(),
      '#imageZoomImage': mockElement(),
      '#a11yLiveRegion': mockElement(),
    };

    const $w = vi.fn((sel) => elements[sel] || mockElement());
    const state = { product: { _id: 'p1', name: 'Test', collections: ['futon-frames'], mediaItems: [] } };

    const result = initImageGallery($w, state);

    // Should return an object with destroy function (even if internal
    // listeners weren't registered due to mock limitations)
    expect(result).toBeDefined();
    expect(typeof result.destroy).toBe('function');

    // destroy should be safe to call
    expect(() => result.destroy()).not.toThrow();
  });

  it('destroy is safe to call when no gallery exists', async () => {
    const { initImageGallery } = await import('../src/public/ProductGallery.js');
    const $w = vi.fn(() => null);
    const result = initImageGallery($w, { product: null });
    expect(result).toBeDefined();
    expect(() => result.destroy()).not.toThrow();
  });
});
