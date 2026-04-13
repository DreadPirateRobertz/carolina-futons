/**
 * Tests for ReviewsCarousel.js — CF-796
 * Auto-advancing homepage reviews carousel.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGetFeaturedReviews } = vi.hoisted(() => ({
  mockGetFeaturedReviews: vi.fn(),
}));

vi.mock('backend/reviewsService.web', () => ({
  getFeaturedReviews: mockGetFeaturedReviews,
}));

import { initReviewsCarousel } from '../src/public/ReviewsCarousel.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEl(overrides = {}) {
  return {
    text: '',
    label: '',
    collapse: vi.fn(),
    expand:   vi.fn(),
    show:     vi.fn(),
    hide:     vi.fn(),
    onClick:  vi.fn(),
    onMouseIn:  vi.fn(),
    onMouseOut: vi.fn(),
    ...overrides,
  };
}

function makeElements() {
  const elements = {
    '#reviewCarouselSection': makeEl(),
    '#reviewCarouselName':    makeEl(),
    '#reviewCarouselRating':  makeEl(),
    '#reviewCarouselProduct': makeEl(),
    '#reviewCarouselBody':    makeEl(),
    '#reviewCarouselExpand':  makeEl(),
    '#reviewCarouselPrev':    makeEl(),
    '#reviewCarouselNext':    makeEl(),
    '#reviewCarouselDots':    makeEl(),
  };
  return {
    $w: (id) => elements[id] || makeEl(),
    elements,
  };
}

function makeReviews(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    _id:         `rev-${i}`,
    authorName:  `Reviewer ${i}`,
    rating:      4 + (i % 2),
    title:       `Great futon ${i}`,
    body:        `This futon is amazing. I love it so much. ${i} stars all the way. Highly recommend.`,
    productName: `Product ${i}`,
    productId:   `prod-${i}`,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews: makeReviews() });
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Empty state ───────────────────────────────────────────────────────────────

describe('initReviewsCarousel — empty state', () => {
  it('collapses section when getFeaturedReviews returns no reviews', async () => {
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews: [] });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when getFeaturedReviews returns success:false', async () => {
    mockGetFeaturedReviews.mockResolvedValue({ success: false, reviews: [] });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].collapse).toHaveBeenCalled();
  });

  it('collapses section when getFeaturedReviews throws', async () => {
    mockGetFeaturedReviews.mockRejectedValue(new Error('network error'));
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].collapse).toHaveBeenCalled();
  });

  it('collapses when reviews field is undefined', async () => {
    mockGetFeaturedReviews.mockResolvedValue({ success: true });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].collapse).toHaveBeenCalled();
  });
});

// ── Initial render ────────────────────────────────────────────────────────────

describe('initReviewsCarousel — initial render', () => {
  it('expands section when reviews are available', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].expand).toHaveBeenCalled();
  });

  it('calls getFeaturedReviews with limit 10', async () => {
    const { $w } = makeElements();
    await initReviewsCarousel($w);
    expect(mockGetFeaturedReviews).toHaveBeenCalledWith({ limit: 10 });
  });

  it('renders reviewer name for first review', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0');
  });

  it('renders star rating for first review', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    // Reviewer 0 has rating 4
    expect(elements['#reviewCarouselRating'].text).toBe('\u2605\u2605\u2605\u2605\u2606');
  });

  it('renders product name for first review', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselProduct'].text).toBe('Product 0');
  });

  it('renders truncated body (≤120 chars) for first review', async () => {
    const reviews = [{ _id: 'r-0', authorName: 'A', rating: 5, productName: 'P',
      body: 'x'.repeat(200) }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselBody'].text.length).toBeLessThanOrEqual(120);
    expect(elements['#reviewCarouselBody'].text).toMatch(/…$/);
  });

  it('renders full body when body is within truncation limit', async () => {
    const reviews = [{ _id: 'r-s', authorName: 'B', rating: 3, productName: 'Q',
      body: 'Short review.' }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselBody'].text).toBe('Short review.');
  });

  it('renders dot indicators for first review', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    // 3 reviews, first selected: "● ○ ○"
    expect(elements['#reviewCarouselDots'].text).toBe('\u25CF \u25CB \u25CB');
  });

  it('hides expand button when body is short', async () => {
    const reviews = [{ _id: 'r-short', authorName: 'C', rating: 4, productName: 'R',
      body: 'Short.' }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselExpand'].hide).toHaveBeenCalled();
  });

  it('shows expand button when body exceeds truncation limit', async () => {
    const reviews = [{ _id: 'r-long', authorName: 'D', rating: 5, productName: 'S',
      body: 'y'.repeat(200) }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselExpand'].show).toHaveBeenCalled();
  });
});

// ── Auto-advance timer ────────────────────────────────────────────────────────

describe('initReviewsCarousel — auto-advance timer', () => {
  it('advances to the next review after 5s', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0');
    vi.advanceTimersByTime(5000);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 1');
  });

  it('wraps around to the first review after the last', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    vi.advanceTimersByTime(5000 * 3); // advance past all 3 reviews
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0');
  });

  it('advances dot indicators with timer', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    vi.advanceTimersByTime(5000);
    expect(elements['#reviewCarouselDots'].text).toBe('\u25CB \u25CF \u25CB');
  });

  it('does not advance when paused', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);

    // Trigger hover-in (pause)
    const mouseInHandler = elements['#reviewCarouselSection'].onMouseIn.mock.calls[0]?.[0];
    mouseInHandler?.();

    vi.advanceTimersByTime(5000);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0'); // no advance
  });

  it('resumes advancing after hover-out', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);

    const mouseInHandler  = elements['#reviewCarouselSection'].onMouseIn.mock.calls[0]?.[0];
    const mouseOutHandler = elements['#reviewCarouselSection'].onMouseOut.mock.calls[0]?.[0];

    mouseInHandler?.();
    vi.advanceTimersByTime(5000);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0'); // paused

    mouseOutHandler?.();
    vi.advanceTimersByTime(5000);
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 1'); // advanced
  });
});

// ── Pause on hover ────────────────────────────────────────────────────────────

describe('initReviewsCarousel — pause on hover', () => {
  it('registers onMouseIn handler on the section', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].onMouseIn).toHaveBeenCalled();
  });

  it('registers onMouseOut handler on the section', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselSection'].onMouseOut).toHaveBeenCalled();
  });
});

// ── Prev / Next controls ──────────────────────────────────────────────────────

describe('initReviewsCarousel — prev/next controls', () => {
  it('advances to next review on next button click', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    const nextHandler = elements['#reviewCarouselNext'].onClick.mock.calls[0]?.[0];
    nextHandler?.();
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 1');
  });

  it('goes to previous review on prev button click', async () => {
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    const prevHandler = elements['#reviewCarouselPrev'].onClick.mock.calls[0]?.[0];
    prevHandler?.();
    // Index 0 → prev wraps to last (index 2)
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 2');
  });

  it('resets expanded state when navigating', async () => {
    const reviews = [
      { _id: 'r-0', authorName: 'A', rating: 5, productName: 'P', body: 'y'.repeat(200) },
      { _id: 'r-1', authorName: 'B', rating: 4, productName: 'Q', body: 'Short.' },
    ];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);

    // Expand the first review
    const expandHandler = elements['#reviewCarouselExpand'].onClick.mock.calls[0]?.[0];
    expandHandler?.();
    expect(elements['#reviewCarouselBody'].text).toBe('y'.repeat(200));

    // Navigate to next — expanded should reset
    const nextHandler = elements['#reviewCarouselNext'].onClick.mock.calls[0]?.[0];
    nextHandler?.();
    expect(elements['#reviewCarouselBody'].text).toBe('Short.');
  });
});

// ── Expand / collapse body ────────────────────────────────────────────────────

describe('initReviewsCarousel — expand/collapse body', () => {
  it('expands full body when Read more is clicked', async () => {
    const body = 'z'.repeat(200);
    const reviews = [{ _id: 'r-e', authorName: 'E', rating: 5, productName: 'T', body }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    const expandHandler = elements['#reviewCarouselExpand'].onClick.mock.calls[0]?.[0];
    expandHandler?.();
    expect(elements['#reviewCarouselBody'].text).toBe(body);
  });

  it('collapses body when Show less is clicked', async () => {
    const body = 'z'.repeat(200);
    const reviews = [{ _id: 'r-c', authorName: 'F', rating: 5, productName: 'U', body }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    const expandHandler = elements['#reviewCarouselExpand'].onClick.mock.calls[0]?.[0];
    expandHandler?.(); // expand
    expandHandler?.(); // collapse
    expect(elements['#reviewCarouselBody'].text.length).toBeLessThanOrEqual(120);
  });

  it('shows Show less label when expanded', async () => {
    const body = 'z'.repeat(200);
    const reviews = [{ _id: 'r-sl', authorName: 'G', rating: 5, productName: 'V', body }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    const expandHandler = elements['#reviewCarouselExpand'].onClick.mock.calls[0]?.[0];
    expandHandler?.();
    expect(elements['#reviewCarouselExpand'].label).toBe('Show less');
  });

  it('shows Read more label when collapsed', async () => {
    const body = 'z'.repeat(200);
    const reviews = [{ _id: 'r-rm', authorName: 'H', rating: 5, productName: 'W', body }];
    mockGetFeaturedReviews.mockResolvedValue({ success: true, reviews });
    const { $w, elements } = makeElements();
    await initReviewsCarousel($w);
    expect(elements['#reviewCarouselExpand'].label).toBe('Read more');
  });
});

// ── destroy ───────────────────────────────────────────────────────────────────

describe('initReviewsCarousel — destroy / timer cleanup', () => {
  it('returns a destroy function', async () => {
    const { $w } = makeElements();
    const result = await initReviewsCarousel($w);
    expect(typeof result.destroy).toBe('function');
  });

  it('stops auto-advancing after destroy', async () => {
    const { $w, elements } = makeElements();
    const { destroy } = await initReviewsCarousel($w);
    destroy();
    vi.advanceTimersByTime(5000 * 5);
    // Timer cleared — should still show first review
    expect(elements['#reviewCarouselName'].text).toBe('Reviewer 0');
  });

  it('destroy() can be called multiple times without throwing', async () => {
    const { $w } = makeElements();
    const { destroy } = await initReviewsCarousel($w);
    expect(() => { destroy(); destroy(); }).not.toThrow();
  });
});
