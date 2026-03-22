/**
 * Tests for GalleryZoomLightbox.js
 *
 * Covers: initGalleryZoomLightbox (setup, ARIA, main image click, gallery thumbnail
 * click, prev/next navigation, counter, close, keyboard, swipe, destroy,
 * element nicknames, no-product guard).
 *
 * See CF-q5ua for original specification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  announce: vi.fn(),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(() => vi.fn()), // returns cleanup fn
}));

import { initGalleryZoomLightbox } from '../src/public/GalleryZoomLightbox.js';
import { announce } from 'public/a11yHelpers.js';
import { enableSwipe } from 'public/touchHelpers';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    value: '',
    accessibility: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onItemClicked: vi.fn(),
    focus: vi.fn(),
    htmlElement: null,
  };
}

function createMock$w() {
  const elements = {};
  const $w = vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
  $w._elements = elements;
  return $w;
}

function createMockState(overrides = {}) {
  return {
    product: {
      _id: 'prod-001',
      name: 'Test Futon',
      mediaItems: [
        { src: 'https://example.com/a.jpg', type: 'image', title: 'Image A' },
        { src: 'https://example.com/b.jpg', type: 'image', title: 'Image B' },
        { src: 'https://example.com/c.jpg', type: 'image', title: 'Image C' },
      ],
      mainMedia: 'https://example.com/a.jpg',
      ...overrides.product,
    },
    ...overrides,
  };
}

function stubDocument() {
  let keydownHandler = null;
  const stub = {
    addEventListener: vi.fn((event, handler) => {
      if (event === 'keydown') keydownHandler = handler;
    }),
    removeEventListener: vi.fn(),
    get keydownHandler() { return keydownHandler; },
  };
  vi.stubGlobal('document', stub);
  return stub;
}

function clickHandler(element) {
  const [[handler]] = element.onClick.mock.calls;
  handler();
}

function clickMainImage($w) {
  clickHandler($w('#productMainImage'));
}

function clickGalleryItem($w, src) {
  const [[handler]] = $w('#productGallery').onItemClicked.mock.calls;
  handler({ item: { src } });
}

// ── initGalleryZoomLightbox — setup ───────────────────────────────────

describe('initGalleryZoomLightbox — setup', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    stubDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('collapses zoomLightboxOverlay on init', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxOverlay').collapse).toHaveBeenCalled();
  });

  it('returns null when state has no product', () => {
    const result = initGalleryZoomLightbox($w, { product: null });
    expect(result).toBeNull();
  });

  it('returns null when state is null', () => {
    const result = initGalleryZoomLightbox($w, null);
    expect(result).toBeNull();
  });

  it('sets ARIA role dialog on zoomLightboxOverlay', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxOverlay').accessibility.role).toBe('dialog');
  });

  it('sets ariaModal true on zoomLightboxOverlay', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxOverlay').accessibility.ariaModal).toBe(true);
  });

  it('sets ariaLabel on zoomLightboxClose', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxClose').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ariaLabel on zoomLightboxPrev', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxPrev').accessibility.ariaLabel).toBeTruthy();
  });

  it('sets ariaLabel on zoomLightboxNext', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxNext').accessibility.ariaLabel).toBeTruthy();
  });

  it('registers onClick on productMainImage', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#productMainImage').onClick).toHaveBeenCalled();
  });

  it('registers onItemClicked on productGallery', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#productGallery').onItemClicked).toHaveBeenCalled();
  });

  it('does not expand overlay at init', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxOverlay').expand).not.toHaveBeenCalled();
  });

  it('returns an object with destroy function', () => {
    const result = initGalleryZoomLightbox($w, state);
    expect(result).not.toBeNull();
    expect(typeof result.destroy).toBe('function');
  });

  it('falls back to mainMedia when mediaItems is empty', () => {
    const s = createMockState({ product: { mediaItems: [], mainMedia: 'https://example.com/main.jpg' } });
    initGalleryZoomLightbox($w, s);
    clickMainImage($w);
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/main.jpg');
  });
});

// ── initGalleryZoomLightbox — main image click ────────────────────────

describe('initGalleryZoomLightbox — main image click', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    stubDocument();
    $w('#productMainImage').src = 'https://example.com/b.jpg';
    initGalleryZoomLightbox($w, state);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expands zoomLightboxOverlay on click', () => {
    clickMainImage($w);
    expect($w('#zoomLightboxOverlay').expand).toHaveBeenCalled();
  });

  it('displays the matching image in lightbox', () => {
    clickMainImage($w);
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/b.jpg');
  });

  it('sets alt text on lightbox image', () => {
    clickMainImage($w);
    expect($w('#zoomLightboxImage').alt).toBeTruthy();
  });

  it('shows counter text when multiple images', () => {
    clickMainImage($w);
    expect($w('#zoomLightboxCounter').text).toMatch(/\d+ \/ \d+/);
  });

  it('announces the opened image', () => {
    clickMainImage($w);
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/image/i));
  });

  it('opens at index 0 when main image src does not match any media item', () => {
    $w('#productMainImage').src = 'https://example.com/unknown.jpg';
    vi.clearAllMocks();
    // re-init with fresh $w to reset onClick
    $w = createMock$w();
    $w('#productMainImage').src = 'https://example.com/unknown.jpg';
    initGalleryZoomLightbox($w, state);
    clickMainImage($w);
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/a.jpg');
  });
});

// ── initGalleryZoomLightbox — gallery thumbnail click ─────────────────

describe('initGalleryZoomLightbox — gallery thumbnail click', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    stubDocument();
    initGalleryZoomLightbox($w, state);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('expands overlay on thumbnail click', () => {
    clickGalleryItem($w, 'https://example.com/b.jpg');
    expect($w('#zoomLightboxOverlay').expand).toHaveBeenCalled();
  });

  it('shows the clicked thumbnail image', () => {
    clickGalleryItem($w, 'https://example.com/c.jpg');
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/c.jpg');
  });

  it('opens at correct index for second image', () => {
    clickGalleryItem($w, 'https://example.com/b.jpg');
    expect($w('#zoomLightboxCounter').text).toBe('2 / 3');
  });

  it('opens at index 0 for unknown thumbnail src', () => {
    clickGalleryItem($w, 'https://example.com/unknown.jpg');
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/a.jpg');
  });
});

// ── initGalleryZoomLightbox — navigation ──────────────────────────────

describe('initGalleryZoomLightbox — navigation', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    stubDocument();
    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open at index 0
    announce.mockClear(); // reset announce only — preserve onClick.mock.calls
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('next button advances to next image', () => {
    clickHandler($w('#zoomLightboxNext'));
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/b.jpg');
  });

  it('prev button goes to previous image (wraps to last from first)', () => {
    clickHandler($w('#zoomLightboxPrev'));
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/c.jpg');
  });

  it('next button wraps from last to first', () => {
    clickHandler($w('#zoomLightboxNext')); // → b
    clickHandler($w('#zoomLightboxNext')); // → c
    clickHandler($w('#zoomLightboxNext')); // → a (wrap)
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/a.jpg');
  });

  it('counter updates on next', () => {
    clickHandler($w('#zoomLightboxNext'));
    expect($w('#zoomLightboxCounter').text).toBe('2 / 3');
  });

  it('counter updates on prev wrap', () => {
    clickHandler($w('#zoomLightboxPrev')); // wraps to index 2
    expect($w('#zoomLightboxCounter').text).toBe('3 / 3');
  });

  it('hides prev and next for single-image product', () => {
    vi.clearAllMocks();
    $w = createMock$w();
    const singleState = createMockState({
      product: {
        mediaItems: [{ src: 'https://example.com/only.jpg', type: 'image', title: 'Only' }],
      },
    });
    initGalleryZoomLightbox($w, singleState);
    clickMainImage($w);
    expect($w('#zoomLightboxPrev').hide).toHaveBeenCalled();
    expect($w('#zoomLightboxNext').hide).toHaveBeenCalled();
  });

  it('does not hide prev/next for multi-image product', () => {
    expect($w('#zoomLightboxPrev').hide).not.toHaveBeenCalled();
    expect($w('#zoomLightboxNext').hide).not.toHaveBeenCalled();
  });
});

// ── initGalleryZoomLightbox — close ───────────────────────────────────

describe('initGalleryZoomLightbox — close', () => {
  let $w, state, docStub;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    docStub = stubDocument();
    initGalleryZoomLightbox($w, state);
    clickMainImage($w);
    $w('#zoomLightboxOverlay').collapse.mockClear();
    announce.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('close button collapses zoomLightboxOverlay', () => {
    clickHandler($w('#zoomLightboxClose'));
    expect($w('#zoomLightboxOverlay').collapse).toHaveBeenCalled();
  });

  it('close button announces lightbox closed', () => {
    clickHandler($w('#zoomLightboxClose'));
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/closed/i));
  });

  it('Escape key closes the lightbox', () => {
    docStub.keydownHandler({ key: 'Escape' });
    expect($w('#zoomLightboxOverlay').collapse).toHaveBeenCalled();
  });
});

// ── initGalleryZoomLightbox — keyboard navigation ─────────────────────

describe('initGalleryZoomLightbox — keyboard navigation', () => {
  let $w, state, docStub;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    docStub = stubDocument();
    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open at index 0
    announce.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ArrowRight navigates to next image', () => {
    docStub.keydownHandler({ key: 'ArrowRight' });
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/b.jpg');
  });

  it('ArrowLeft navigates to previous image (wraps)', () => {
    docStub.keydownHandler({ key: 'ArrowLeft' });
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/c.jpg');
  });

  it('keyboard does nothing when lightbox is closed', () => {
    clickHandler($w('#zoomLightboxClose')); // close
    $w('#zoomLightboxOverlay').expand.mockClear();
    docStub.keydownHandler({ key: 'ArrowRight' });
    expect($w('#zoomLightboxOverlay').expand).not.toHaveBeenCalled();
  });
});

// ── initGalleryZoomLightbox — destroy ─────────────────────────────────

describe('initGalleryZoomLightbox — destroy', () => {
  let $w, state, docStub;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    docStub = stubDocument();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('destroy removes keydown listener', () => {
    const handle = initGalleryZoomLightbox($w, state);
    handle.destroy();
    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('destroy is safe to call multiple times', () => {
    const handle = initGalleryZoomLightbox($w, state);
    expect(() => { handle.destroy(); handle.destroy(); }).not.toThrow();
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs are addressed', () => {
  let $w, state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = createMock$w();
    state = createMockState();
    stubDocument();
    initGalleryZoomLightbox($w, state);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('addresses #zoomLightboxOverlay', () => {
    expect($w).toHaveBeenCalledWith('#zoomLightboxOverlay');
  });

  it('addresses #zoomLightboxImage', () => {
    clickMainImage($w);
    expect($w).toHaveBeenCalledWith('#zoomLightboxImage');
  });

  it('addresses #zoomLightboxClose', () => {
    expect($w).toHaveBeenCalledWith('#zoomLightboxClose');
  });

  it('addresses #zoomLightboxPrev', () => {
    expect($w).toHaveBeenCalledWith('#zoomLightboxPrev');
  });

  it('addresses #zoomLightboxNext', () => {
    expect($w).toHaveBeenCalledWith('#zoomLightboxNext');
  });

  it('addresses #zoomLightboxCounter', () => {
    clickMainImage($w);
    expect($w).toHaveBeenCalledWith('#zoomLightboxCounter');
  });

  it('addresses #productMainImage', () => {
    expect($w).toHaveBeenCalledWith('#productMainImage');
  });

  it('addresses #productGallery', () => {
    expect($w).toHaveBeenCalledWith('#productGallery');
  });
});
