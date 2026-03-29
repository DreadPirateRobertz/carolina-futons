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
