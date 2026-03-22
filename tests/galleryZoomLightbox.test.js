/**
 * Tests for GalleryZoomLightbox.js
 *
 * Covers: initGalleryZoomLightbox (setup, ARIA, accessible dialog config, main image
 * click, gallery thumbnail click, prev/next navigation, counter, announce, swipe,
 * close via onClose callback, keyboard arrow navigation, destroy, element nicknames
 * (Wix element IDs used in $w selector calls), and no-product/no-images guards).
 *
 * See CF-q5ua for original specification.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('public/a11yHelpers.js', () => ({
  setupAccessibleDialog: vi.fn(),
  announce: vi.fn(),
}));

vi.mock('public/touchHelpers', () => ({
  enableSwipe: vi.fn(() => vi.fn()), // returns cleanup fn
}));

import { initGalleryZoomLightbox } from '../src/public/GalleryZoomLightbox.js';
import { setupAccessibleDialog, announce } from 'public/a11yHelpers.js';
import { enableSwipe } from 'public/touchHelpers';

// ── Test Helpers ──────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    src: '',
    alt: '',
    accessibility: {},
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    onClick: vi.fn(),
    onItemClicked: vi.fn(),
    htmlElement: null,
  };
}

function createMock$w() {
  const elements = {};
  return vi.fn((selector) => {
    if (!elements[selector]) elements[selector] = createMockElement();
    return elements[selector];
  });
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

// Stubs document to capture only the keydown handler for keyboard navigation tests.
// Extend captured events if testing other document-level listeners.
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

// Extract the handler registered via onClick.mock.calls.
// Uses the most recently registered call so tests remain correct if wiring order changes.
function clickHandler(element) {
  const calls = element.onClick.mock.calls;
  if (!calls.length) throw new Error('No onClick handler registered on element');
  const handler = calls[calls.length - 1][0];
  handler();
}

function clickMainImage($w) {
  clickHandler($w('#productMainImage'));
}

function clickGalleryItem($w, src) {
  const calls = $w('#productGallery').onItemClicked.mock.calls;
  if (!calls.length) throw new Error('No onItemClicked handler registered on #productGallery');
  calls[calls.length - 1][0]({ item: { src } });
}

// ── Shared setup (hoisted to avoid repetition across all describes) ───

let $w, state, mockDialog, docStub;

beforeEach(() => {
  vi.clearAllMocks();
  $w = createMock$w();
  state = createMockState();
  mockDialog = { open: vi.fn(), close: vi.fn() };
  setupAccessibleDialog.mockReturnValue(mockDialog);
  docStub = stubDocument();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── initGalleryZoomLightbox — setup ───────────────────────────────────

describe('initGalleryZoomLightbox — setup', () => {
  it('collapses zoomLightboxOverlay on init', () => {
    initGalleryZoomLightbox($w, state);
    expect($w('#zoomLightboxOverlay').collapse).toHaveBeenCalled();
  });

  it('returns null when state has no product', () => {
    expect(initGalleryZoomLightbox($w, { product: null })).toBeNull();
  });

  it('returns null when state is null', () => {
    expect(initGalleryZoomLightbox($w, null)).toBeNull();
  });

  it('returns null when product has no images and no mainMedia', () => {
    const s = createMockState({ product: { mediaItems: [], mainMedia: undefined } });
    expect(initGalleryZoomLightbox($w, s)).toBeNull();
  });

  it('calls setupAccessibleDialog with panelId #zoomLightboxOverlay', () => {
    initGalleryZoomLightbox($w, state);
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({ panelId: '#zoomLightboxOverlay' })
    );
  });

  it('calls setupAccessibleDialog with closeId #zoomLightboxClose', () => {
    initGalleryZoomLightbox($w, state);
    expect(setupAccessibleDialog).toHaveBeenCalledWith(
      $w,
      expect.objectContaining({ closeId: '#zoomLightboxClose' })
    );
  });

  it('calls setupAccessibleDialog with focusableIds including nav buttons', () => {
    initGalleryZoomLightbox($w, state);
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.focusableIds).toContain('#zoomLightboxPrev');
    expect(config.focusableIds).toContain('#zoomLightboxNext');
  });

  it('calls setupAccessibleDialog with an onClose callback', () => {
    initGalleryZoomLightbox($w, state);
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(typeof config.onClose).toBe('function');
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

  it('does not open dialog at init', () => {
    initGalleryZoomLightbox($w, state);
    expect(mockDialog.open).not.toHaveBeenCalled();
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

  it('includes items with mediaType image when type is absent', () => {
    const s = createMockState({
      product: {
        mediaItems: [{ src: 'https://example.com/x.jpg', mediaType: 'image', title: 'X' }],
        mainMedia: undefined,
      },
    });
    initGalleryZoomLightbox($w, s);
    clickMainImage($w);
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/x.jpg');
  });

  it('filters out video items from the image list', () => {
    const s = createMockState({
      product: {
        mediaItems: [
          { src: 'https://example.com/a.jpg', type: 'image', title: 'A' },
          { src: 'https://example.com/v.mp4', type: 'video', title: 'V' },
          { src: 'https://example.com/b.jpg', type: 'image', title: 'B' },
        ],
      },
    });
    initGalleryZoomLightbox($w, s);
    clickMainImage($w);
    expect($w('#zoomLightboxCounter').text).toBe('1 / 2');
  });
});

// ── initGalleryZoomLightbox — main image click ────────────────────────

describe('initGalleryZoomLightbox — main image click', () => {
  beforeEach(() => {
    $w('#productMainImage').src = 'https://example.com/b.jpg';
    initGalleryZoomLightbox($w, state);
  });

  it('calls dialog.open on click', () => {
    clickMainImage($w);
    expect(mockDialog.open).toHaveBeenCalled();
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
    $w = createMock$w();
    $w('#productMainImage').src = 'https://example.com/unknown.jpg';
    setupAccessibleDialog.mockReturnValue(mockDialog);
    initGalleryZoomLightbox($w, state);
    clickMainImage($w);
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/a.jpg');
  });
});

// ── initGalleryZoomLightbox — gallery thumbnail click ─────────────────

describe('initGalleryZoomLightbox — gallery thumbnail click', () => {
  beforeEach(() => {
    initGalleryZoomLightbox($w, state);
  });

  it('calls dialog.open on thumbnail click', () => {
    clickGalleryItem($w, 'https://example.com/b.jpg');
    expect(mockDialog.open).toHaveBeenCalled();
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
  beforeEach(() => {
    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open at index 0
    // Only clear announce — vi.clearAllMocks() would wipe onClick.mock.calls, which
    // clickHandler() reads to retrieve the registered handler reference.
    announce.mockClear();
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

  it('announce is called on next navigation', () => {
    clickHandler($w('#zoomLightboxNext'));
    expect(announce).toHaveBeenCalledWith($w, 'Image 2 of 3');
  });

  it('announce is called on prev wrap navigation', () => {
    clickHandler($w('#zoomLightboxPrev'));
    expect(announce).toHaveBeenCalledWith($w, 'Image 3 of 3');
  });

  it('hides prev and next for single-image product', () => {
    vi.clearAllMocks();
    $w = createMock$w();
    setupAccessibleDialog.mockReturnValue(mockDialog);
    const s = createMockState({
      product: { mediaItems: [{ src: 'https://example.com/only.jpg', type: 'image', title: 'Only' }] },
    });
    initGalleryZoomLightbox($w, s);
    clickMainImage($w);
    expect($w('#zoomLightboxPrev').hide).toHaveBeenCalled();
    expect($w('#zoomLightboxNext').hide).toHaveBeenCalled();
  });

  it('counter text is empty string for single-image product', () => {
    vi.clearAllMocks();
    $w = createMock$w();
    setupAccessibleDialog.mockReturnValue(mockDialog);
    const s = createMockState({
      product: { mediaItems: [{ src: 'https://example.com/only.jpg', type: 'image', title: 'Only' }] },
    });
    initGalleryZoomLightbox($w, s);
    clickMainImage($w);
    expect($w('#zoomLightboxCounter').text).toBe('');
  });

  it('shows prev and next when re-opening multi-image lightbox', () => {
    const { onClose } = setupAccessibleDialog.mock.calls[0][1];
    onClose(); // close
    $w('#zoomLightboxPrev').show.mockClear();
    $w('#zoomLightboxNext').show.mockClear();
    clickMainImage($w); // re-open
    expect($w('#zoomLightboxPrev').show).toHaveBeenCalled();
    expect($w('#zoomLightboxNext').show).toHaveBeenCalled();
  });

  it('does not hide prev/next for multi-image product', () => {
    expect($w('#zoomLightboxPrev').hide).not.toHaveBeenCalled();
    expect($w('#zoomLightboxNext').hide).not.toHaveBeenCalled();
  });
});

// ── initGalleryZoomLightbox — close ───────────────────────────────────

describe('initGalleryZoomLightbox — close', () => {
  beforeEach(() => {
    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open
    announce.mockClear();
  });

  it('onClose callback announces lightbox closed', () => {
    const { onClose } = setupAccessibleDialog.mock.calls[0][1];
    onClose();
    expect(announce).toHaveBeenCalledWith($w, expect.stringMatching(/closed/i));
  });

  it('onClose callback sets isOpen to false (subsequent arrows do nothing)', () => {
    const { onClose } = setupAccessibleDialog.mock.calls[0][1];
    onClose();
    const srcBefore = $w('#zoomLightboxImage').src;
    docStub.keydownHandler({ key: 'ArrowRight' });
    expect($w('#zoomLightboxImage').src).toBe(srcBefore);
  });
});

// ── initGalleryZoomLightbox — keyboard navigation ─────────────────────

describe('initGalleryZoomLightbox — keyboard navigation', () => {
  beforeEach(() => {
    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open at index 0
    announce.mockClear();
  });

  it('ArrowRight navigates to next image', () => {
    docStub.keydownHandler({ key: 'ArrowRight' });
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/b.jpg');
  });

  it('ArrowLeft navigates to previous image (wraps)', () => {
    docStub.keydownHandler({ key: 'ArrowLeft' });
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/c.jpg');
  });

  it('ArrowRight does not change image when lightbox is closed', () => {
    const { onClose } = setupAccessibleDialog.mock.calls[0][1];
    onClose();
    const srcBefore = $w('#zoomLightboxImage').src;
    docStub.keydownHandler({ key: 'ArrowRight' });
    expect($w('#zoomLightboxImage').src).toBe(srcBefore);
  });

  it('unrecognised keys do nothing', () => {
    const srcBefore = $w('#zoomLightboxImage').src;
    docStub.keydownHandler({ key: 'Enter' });
    expect($w('#zoomLightboxImage').src).toBe(srcBefore);
  });
});

// ── initGalleryZoomLightbox — swipe navigation ────────────────────────

describe('initGalleryZoomLightbox — swipe navigation', () => {
  let capturedSwipeCb, mockCleanup;

  beforeEach(() => {
    mockCleanup = vi.fn();
    capturedSwipeCb = null;
    enableSwipe.mockImplementation((_el, cb) => { capturedSwipeCb = cb; return mockCleanup; });

    // Give overlay an htmlElement so swipe is initialised
    $w('#zoomLightboxOverlay').htmlElement = { addEventListener: vi.fn() };

    initGalleryZoomLightbox($w, state);
    clickMainImage($w); // open at index 0
    announce.mockClear();
  });

  it('swipe left advances to next image', () => {
    capturedSwipeCb('left');
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/b.jpg');
  });

  it('swipe right goes to previous image (wraps)', () => {
    capturedSwipeCb('right');
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/c.jpg');
  });

  it('swipe does nothing when lightbox is closed', () => {
    const { onClose } = setupAccessibleDialog.mock.calls[0][1];
    onClose();
    capturedSwipeCb('left');
    expect($w('#zoomLightboxImage').src).toBe('https://example.com/a.jpg'); // unchanged
  });
});

// ── initGalleryZoomLightbox — destroy ─────────────────────────────────

describe('initGalleryZoomLightbox — destroy', () => {
  it('destroy removes keydown listener', () => {
    const handle = initGalleryZoomLightbox($w, state);
    handle.destroy();
    expect(document.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('destroy calls swipe cleanup when swipe was initialised', () => {
    const mockCleanup = vi.fn();
    enableSwipe.mockReturnValue(mockCleanup);
    $w('#zoomLightboxOverlay').htmlElement = { addEventListener: vi.fn() };
    const handle = initGalleryZoomLightbox($w, state);
    handle.destroy();
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('destroy is safe to call multiple times', () => {
    const handle = initGalleryZoomLightbox($w, state);
    expect(() => { handle.destroy(); handle.destroy(); }).not.toThrow();
  });
});

// ── element nicknames ─────────────────────────────────────────────────

describe('element nicknames — all required IDs are addressed', () => {
  beforeEach(() => {
    initGalleryZoomLightbox($w, state);
  });

  it('addresses #zoomLightboxOverlay', () => {
    expect($w).toHaveBeenCalledWith('#zoomLightboxOverlay');
  });

  it('addresses #zoomLightboxImage', () => {
    clickMainImage($w);
    expect($w).toHaveBeenCalledWith('#zoomLightboxImage');
  });

  it('passes #zoomLightboxClose as closeId to setupAccessibleDialog', () => {
    const config = setupAccessibleDialog.mock.calls[0][1];
    expect(config.closeId).toBe('#zoomLightboxClose');
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
