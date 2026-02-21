import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProductReviews } from '../src/public/ProductReviews.js';
import { futonFrame } from './fixtures/products.js';

// Mock backend module
const mockAggregate = { average: 4.5, total: 12, breakdown: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 } };
const mockReviews = {
  reviews: [
    { _id: 'rev-1', authorName: 'Sarah M.', rating: 5, title: 'Great', body: 'Solid build.', photos: [], verifiedPurchase: true, helpful: 3, date: 'January 15, 2026' },
    { _id: 'rev-2', authorName: 'Tom B.', rating: 4, title: 'Good', body: 'Nice finish.', photos: ['photo.jpg'], verifiedPurchase: false, helpful: 1, date: 'January 10, 2026' },
  ],
  total: 2,
  page: 0,
  pageSize: 10,
};

vi.mock('backend/reviewsService.web', () => ({
  getAggregateRating: vi.fn(async () => mockAggregate),
  getProductReviews: vi.fn(async () => mockReviews),
  submitReview: vi.fn(async () => ({ success: true, reviewId: 'new-001' })),
  markHelpful: vi.fn(async () => ({ success: true, helpful: 4 })),
}));

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    data: [],
    options: [],
    items: [],
    accessibility: { ariaLabel: '', ariaExpanded: false },
  };
}

function create$w() {
  const els = new Map();
  const $w = (sel) => {
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

describe('ProductReviews', () => {
  let $w;
  let state;

  beforeEach(() => {
    vi.clearAllMocks();
    $w = create$w();
    state = { product: { ...futonFrame } };
  });

  it('expands reviews section when product has reviews', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsSection').expand).toHaveBeenCalled();
  });

  it('collapses reviews section when no product ID', async () => {
    state.product._id = null;
    await initProductReviews($w, state);
    expect($w('#reviewsSection').collapse).toHaveBeenCalled();
  });

  it('handles missing reviews section gracefully', async () => {
    const nullW = () => null;
    await expect(initProductReviews(nullW, state)).resolves.not.toThrow();
  });

  it('renders aggregate average', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsAverage').text).toBe('4.5');
  });

  it('renders review count', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsCount').text).toBe('12 reviews');
  });

  it('renders singular review count', async () => {
    const { getAggregateRating } = await import('backend/reviewsService.web');
    getAggregateRating.mockResolvedValueOnce({ average: 5, total: 1, breakdown: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } });

    await initProductReviews($w, state);
    expect($w('#reviewsCount').text).toBe('1 review');
  });

  it('renders star string', async () => {
    await initProductReviews($w, state);
    // 4.5 average → ★★★★½
    expect($w('#reviewsStars').text).toBe('★★★★½');
  });

  it('sets up sort dropdown with options', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsSortDropdown').options).toHaveLength(4);
    expect($w('#reviewsSortDropdown').onChange).toHaveBeenCalled();
  });

  it('sets up pagination buttons', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsNextBtn').onClick).toHaveBeenCalled();
    expect($w('#reviewsPrevBtn').onClick).toHaveBeenCalled();
  });

  it('disables prev button on first page', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewsPrevBtn').disable).toHaveBeenCalled();
  });

  it('sets up submit button', async () => {
    await initProductReviews($w, state);
    expect($w('#reviewSubmitBtn').onClick).toHaveBeenCalled();
  });

  it('renders reviews repeater with data', async () => {
    await initProductReviews($w, state);
    const repeater = $w('#reviewsRepeater');
    expect(repeater.onItemReady).toHaveBeenCalled();
    expect(repeater.data).toHaveLength(2);
  });

  it('shows empty state when no reviews', async () => {
    const { getProductReviews } = await import('backend/reviewsService.web');
    getProductReviews.mockResolvedValueOnce({ reviews: [], total: 0, page: 0, pageSize: 10 });

    await initProductReviews($w, state);
    expect($w('#reviewsEmptyState').show).toHaveBeenCalled();
  });
});
