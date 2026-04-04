/**
 * Tests for VideoReviewGrid.js — CF-ou66.3
 * Horizontal customer video review grid on PDP.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGetVideoReviews } = vi.hoisted(() => ({
  mockGetVideoReviews: vi.fn(),
}));

vi.mock('backend/reviewsService.web', () => ({
  getVideoReviews: mockGetVideoReviews,
}));

import { initVideoReviewGrid } from '../src/public/VideoReviewGrid.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    src: '',
    alt: '',
    data: [],
    collapse: vi.fn(),
    expand: vi.fn(),
    onClick: vi.fn(),
    onItemReady: vi.fn(),
    scrollTo: vi.fn(),
    accessibility: {},
    ...overrides,
  };
}

function makeRepeater() {
  const el = makeEl();
  el.data = [];
  el.onItemReady = vi.fn((cb) => { el._onItemReadyCb = cb; });
  // Simulate Wix repeater setting data = [...] triggers onItemReady per item
  Object.defineProperty(el, 'data', {
    get() { return el._data || []; },
    set(items) {
      el._data = items;
      if (el._onItemReadyCb) {
        for (const item of items) {
          const $item = makeEl();
          $item.text = '';
          $item['#vrThumbnail'] = makeEl();
          $item['#vrPlayIcon'] = makeEl();
          $item['#vrReviewerName'] = makeEl();
          // $item as selector
          const $itemFn = (id) => {
            const key = id.replace('#', '');
            return el._itemEls?.[item._id]?.[key] || makeEl();
          };
          $itemFn._id = item._id;
          el._onItemReadyCb($itemFn, item);
        }
      }
    },
  });
  return el;
}

function makeElements() {
  const repeater = makeRepeater();
  const elements = {
    '#videoReviewSection': makeEl(),
    '#videoReviewTitle': makeEl(),
    '#videoReviewRepeater': repeater,
    '#videoPlayerOverlay': makeEl(),
    '#videoPlayerEmbed': makeEl(),
    '#closeVideoOverlay': makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
    repeater,
  };
}

function makeState(productId = 'prod-1') {
  return { product: { _id: productId } };
}

function makeReviews(count = 2) {
  return Array.from({ length: count }, (_, i) => ({
    _id: `vr-${i}`,
    videoFileId: `wix:video://v1/vid${i}.mp4`,
    caption: `Great futon ${i}`,
    submittedAt: new Date('2026-03-01'),
    reviewerName: `Reviewer ${i}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetVideoReviews.mockResolvedValue({ success: true, reviews: makeReviews() });
});

// ── Section visibility ────────────────────────────────────────────────────────

describe('initVideoReviewGrid — section collapse conditions', () => {
  it('collapses section when productId is missing', async () => {
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, { product: {} });
    expect(elements['#videoReviewSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when getVideoReviews returns no reviews', async () => {
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews: [] });
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#videoReviewSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when getVideoReviews returns success:false', async () => {
    mockGetVideoReviews.mockResolvedValue({ success: false, reviews: [] });
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#videoReviewSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when getVideoReviews throws', async () => {
    mockGetVideoReviews.mockRejectedValue(new Error('DB error'));
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#videoReviewSection'].collapse).toHaveBeenCalled();
  });

  it('expands section when reviews are available', async () => {
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#videoReviewSection'].expand).toHaveBeenCalled();
  });
});

// ── Repeater data ─────────────────────────────────────────────────────────────

describe('initVideoReviewGrid — repeater population', () => {
  it('calls getVideoReviews with correct productId and limit 12', async () => {
    const { $w } = makeElements();
    await initVideoReviewGrid($w, makeState('prod-abc'));
    expect(mockGetVideoReviews).toHaveBeenCalledWith('prod-abc', { limit: 12 });
  });

  it('sets repeater data with _id fields', async () => {
    const { $w, repeater } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(repeater._data).toHaveLength(2);
    expect(repeater._data[0]._id).toBeDefined();
  });

  it('sets section title to Customer Videos', async () => {
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#videoReviewTitle'].text).toBe('Customer Videos');
  });
});

// ── Overlay player ────────────────────────────────────────────────────────────

describe('initVideoReviewGrid — overlay player', () => {
  it('registers onClick on closeVideoOverlay', async () => {
    const { $w, elements } = makeElements();
    await initVideoReviewGrid($w, makeState());
    expect(elements['#closeVideoOverlay'].onClick).toHaveBeenCalled();
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initVideoReviewGrid — destroy', () => {
  it('returns a destroy function', async () => {
    const { $w } = makeElements();
    const result = await initVideoReviewGrid($w, makeState());
    expect(typeof result.destroy).toBe('function');
  });

  it('collapses overlay on destroy', async () => {
    const { $w, elements } = makeElements();
    const { destroy } = await initVideoReviewGrid($w, makeState());
    destroy();
    expect(elements['#videoPlayerOverlay'].collapse).toHaveBeenCalled();
  });
});

// ── Smart repeater for onItemReady / click interaction tests ──────────────────
//
// The basic makeRepeater() returns throwaway elements from onItemReady because
// _itemEls is never populated.  makeSmartRepeater() tracks per-item elements so
// we can assert on reviewer name, thumbnail src, and click handlers.

function makeSmartRepeater() {
  const el = makeEl();
  el._itemEls = {};
  el.onItemReady = vi.fn((cb) => { el._onItemReadyCb = cb; });
  Object.defineProperty(el, 'data', {
    get() { return el._data || []; },
    set(items) {
      el._data = items;
      if (el._onItemReadyCb) {
        for (const item of items) {
          if (!el._itemEls[item._id]) {
            el._itemEls[item._id] = {
              vrThumbnail:   makeEl(),
              vrPlayIcon:    makeEl(),
              vrReviewerName: makeEl(),
            };
          }
          const itemEls = el._itemEls[item._id];
          const $item = (id) => {
            const key = id.replace('#', '');
            return itemEls[key] || makeEl();
          };
          el._onItemReadyCb($item, item);
        }
      }
    },
  });
  return el;
}

function makeSmartElements() {
  const repeater = makeSmartRepeater();
  const embedEl = { ...makeEl(), onMessage: vi.fn() };
  const elements = {
    '#videoReviewSection':  makeEl(),
    '#videoReviewTitle':    makeEl(),
    '#videoReviewRepeater': repeater,
    '#videoPlayerOverlay':  makeEl(),
    '#videoPlayerEmbed':    embedEl,
    '#closeVideoOverlay':   makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
    repeater,
  };
}

// ── onItemReady repeater setup ────────────────────────────────────────────────

describe('initVideoReviewGrid — onItemReady repeater setup', () => {
  it('sets reviewer name text on vrReviewerName element', async () => {
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    expect(repeater._itemEls[id].vrReviewerName.text).toBe('Reviewer 0');
  });

  it('sets thumbnail src from thumbnailUrl', async () => {
    const reviews = [{ _id: 'vr-t', videoFileId: 'wix:video://v1/x.mp4', reviewerName: 'Alice', thumbnailUrl: 'https://img.example.com/thumb.jpg' }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    expect(repeater._itemEls['vr-t'].vrThumbnail.src).toBe('https://img.example.com/thumb.jpg');
  });

  it('sets thumbnail alt text with reviewer name', async () => {
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    expect(repeater._itemEls[id].vrThumbnail.alt).toContain('Reviewer 0');
  });

  it('sets vrPlayIcon ariaLabel to Play video review', async () => {
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    expect(repeater._itemEls[id].vrPlayIcon.accessibility.ariaLabel).toBe('Play video review');
  });

  it('registers onClick on vrThumbnail', async () => {
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    expect(repeater._itemEls[id].vrThumbnail.onClick).toHaveBeenCalled();
  });

  it('registers onClick on vrPlayIcon', async () => {
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    expect(repeater._itemEls[id].vrPlayIcon.onClick).toHaveBeenCalled();
  });
});

// ── truncate (exercised via reviewer name) ────────────────────────────────────

describe('initVideoReviewGrid — truncate via reviewer name', () => {
  it('passes short reviewer name through unchanged', async () => {
    const reviews = [{ _id: 'vr-s', videoFileId: 'wix:video://v1/s.mp4', reviewerName: 'Jo' }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    expect(repeater._itemEls['vr-s'].vrReviewerName.text).toBe('Jo');
  });

  it('truncates reviewer name longer than 30 chars', async () => {
    const longName = 'A'.repeat(31);
    const reviews = [{ _id: 'vr-l', videoFileId: 'wix:video://v1/l.mp4', reviewerName: longName }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const text = repeater._itemEls['vr-l'].vrReviewerName.text;
    expect(text.length).toBeLessThanOrEqual(30);
    expect(text).toMatch(/…$/);
  });

  it('falls back to Customer when reviewerName is empty', async () => {
    const reviews = [{ _id: 'vr-e', videoFileId: 'wix:video://v1/e.mp4', reviewerName: '' }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    expect(repeater._itemEls['vr-e'].vrReviewerName.text).toBe('Customer');
  });
});

// ── buildPlayerHtml (exercised via thumbnail click → openPlayer) ──────────────

describe('initVideoReviewGrid — buildPlayerHtml via thumbnail click', () => {
  it('expands overlay when thumbnail is clicked', async () => {
    const { $w, elements, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    const handler = repeater._itemEls[id].vrThumbnail.onClick.mock.calls[0][0];
    handler();
    expect(elements['#videoPlayerOverlay'].expand).toHaveBeenCalled();
  });

  it('sets embed src to HTML containing the video fileId', async () => {
    const reviews = [{ _id: 'vr-p', videoFileId: 'wix:video://v1/play.mp4', reviewerName: 'Bob' }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const handler = repeater._itemEls['vr-p'].vrThumbnail.onClick.mock.calls[0][0];
    handler();
    expect(elements['#videoPlayerEmbed'].src).toContain('wix:video://v1/play.mp4');
  });

  it('escapes double-quotes in fileId to prevent attribute injection', async () => {
    const reviews = [{ _id: 'vr-q', videoFileId: 'wix://v1/x"inject', reviewerName: 'Eve' }];
    mockGetVideoReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const handler = repeater._itemEls['vr-q'].vrThumbnail.onClick.mock.calls[0][0];
    handler();
    // The " from the fileId should be escaped; raw `"inject` must not appear
    expect(elements['#videoPlayerEmbed'].src).toContain('&quot;inject');
    expect(elements['#videoPlayerEmbed'].src).not.toContain('"inject');
  });

  it('expands overlay when play icon is clicked', async () => {
    const { $w, elements, repeater } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const id = repeater._data[0]._id;
    const handler = repeater._itemEls[id].vrPlayIcon.onClick.mock.calls[0][0];
    handler();
    expect(elements['#videoPlayerOverlay'].expand).toHaveBeenCalled();
  });
});

// ── Overlay close interactions ────────────────────────────────────────────────

describe('initVideoReviewGrid — overlay close interactions', () => {
  it('collapses overlay when close button is clicked', async () => {
    const { $w, elements } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const closeHandler = elements['#closeVideoOverlay'].onClick.mock.calls[0][0];
    closeHandler();
    expect(elements['#videoPlayerOverlay'].collapse).toHaveBeenCalled();
  });

  it('resets embed src to about:blank when close button is clicked', async () => {
    const { $w, elements } = makeSmartElements();
    await initVideoReviewGrid($w, makeState());
    const closeHandler = elements['#closeVideoOverlay'].onClick.mock.calls[0][0];
    closeHandler();
    expect(elements['#videoPlayerEmbed'].src).toBe('about:blank');
  });
});
