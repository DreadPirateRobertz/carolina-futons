import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initProductReviews } from '../src/public/ProductReviews.js';
import { futonFrame } from './fixtures/products.js';

// ── Mock data ────────────────────────────────────────────────────────

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

const mockEmptyReviews = { reviews: [], total: 0, page: 0, pageSize: 10 };
const mockZeroAggregate = { average: 0, total: 0, breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };

const mockMultiPageReviews = {
  reviews: mockReviews.reviews,
  total: 25,
  page: 0,
  pageSize: 10,
};

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('public/ProductPagePolish.js', () => ({
  styleReviewStars: vi.fn((rating) => {
    const r = Math.max(0, Math.min(5, Number(rating) || 0));
    const filled = Math.floor(r);
    const half = r - filled >= 0.5;
    const empty = 5 - filled - (half ? 1 : 0);
    return { filled, half, empty, filledColor: '#E8845C', emptyColor: '#D4BC96' };
  }),
  styleReviewCard: vi.fn(),
}));

vi.mock('backend/reviewsService.web', () => ({
  getAggregateRating: vi.fn(async () => mockAggregate),
  getProductReviews: vi.fn(async () => mockReviews),
  submitReview: vi.fn(async () => ({ success: true, reviewId: 'new-001' })),
  markHelpful: vi.fn(async () => ({ success: true, helpful: 4 })),
}));

// ── Test helpers ─────────────────────────────────────────────────────

function createMockElement() {
  return {
    text: '',
    value: '',
    label: '',
    src: '',
    collapse: vi.fn(() => Promise.resolve()),
    expand: vi.fn(() => Promise.resolve()),
    show: vi.fn(() => Promise.resolve()),
    hide: vi.fn(() => Promise.resolve()),
    enable: vi.fn(),
    disable: vi.fn(),
    onClick: vi.fn(),
    onChange: vi.fn(),
    onItemReady: vi.fn(),
    startUpload: vi.fn(async () => ({ url: 'uploaded.jpg' })),
    data: [],
    options: [],
    items: [],
    style: {},
    accessibility: { ariaLabel: '', ariaExpanded: false, ariaLive: '', role: '', ariaModal: false },
  };
}

function create$w(nullSelectors = []) {
  const els = new Map();
  const $w = (sel) => {
    if (nullSelectors.includes(sel)) return null;
    if (!els.has(sel)) els.set(sel, createMockElement());
    return els.get(sel);
  };
  $w._els = els;
  return $w;
}

/**
 * Simulate onItemReady callback execution for a repeater.
 * @param {Function} $w - Mock selector
 * @param {string} repeaterId - Repeater element ID
 * @param {Array} items - Item data to pass
 * @param {number} [callIndex=0] - Which onItemReady registration to fire (0=first/render, 1=second/helpful)
 */
function fireOnItemReady($w, repeaterId, items, callIndex = 0) {
  const repeater = $w(repeaterId);
  if (!repeater.onItemReady.mock.calls.length) return [];
  const idx = Math.min(callIndex, repeater.onItemReady.mock.calls.length - 1);
  const callback = repeater.onItemReady.mock.calls[idx][0];
  return items.map(item => {
    const $item = create$w();
    callback($item, item);
    return $item;
  });
}

// ── Tests ────────────────────────────────────────────────────────────

describe('ProductReviews', () => {
  let $w;
  let state;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Re-setup default mock implementations after clearAllMocks
    const backend = await import('backend/reviewsService.web');
    backend.getAggregateRating.mockResolvedValue(mockAggregate);
    backend.getProductReviews.mockResolvedValue(mockReviews);
    backend.submitReview.mockResolvedValue({ success: true, reviewId: 'new-001' });
    backend.markHelpful.mockResolvedValue({ success: true, helpful: 4 });

    $w = create$w();
    state = { product: { ...futonFrame } };
  });

  // ── Section lifecycle ──────────────────────────────────────────────

  describe('#reviewsSection lifecycle', () => {
    it('expands reviews section when product has reviews', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSection').expand).toHaveBeenCalled();
    });

    it('collapses reviews section when no product ID', async () => {
      state.product._id = null;
      await initProductReviews($w, state);
      expect($w('#reviewsSection').collapse).toHaveBeenCalled();
    });

    it('collapses reviews section when product is missing', async () => {
      state.product = null;
      await initProductReviews($w, state);
      expect($w('#reviewsSection').collapse).toHaveBeenCalled();
    });

    it('returns silently when #reviewsSection element is missing', async () => {
      const nullW = () => null;
      await expect(initProductReviews(nullW, state)).resolves.not.toThrow();
    });

    it('collapses section on backend error', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockRejectedValue(new Error('Network error'));
      await initProductReviews($w, state);
      expect($w('#reviewsSection').collapse).toHaveBeenCalled();
    });
  });

  // ── Aggregate rating (#reviewsAverage, #reviewsCount, #reviewsStars) ──

  describe('aggregate rating display', () => {
    it('renders average rating text', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsAverage').text).toBe('4.5');
    });

    it('renders dash for average when no reviews', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue(mockZeroAggregate);
      await initProductReviews($w, state);
      expect($w('#reviewsAverage').text).toBe('—');
    });

    it('renders review count with plural', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsCount').text).toBe('12 reviews');
    });

    it('renders singular review count', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue({ average: 5, total: 1, breakdown: { 5: 1, 4: 0, 3: 0, 2: 0, 1: 0 } });
      await initProductReviews($w, state);
      expect($w('#reviewsCount').text).toBe('1 review');
    });

    it('renders "No reviews yet" for zero count', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue(mockZeroAggregate);
      await initProductReviews($w, state);
      expect($w('#reviewsCount').text).toBe('No reviews yet');
    });

    it('renders star string with half star', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsStars').text).toBe('★★★★½');
    });

    it('renders full stars for integer rating', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue({ ...mockAggregate, average: 5.0 });
      await initProductReviews($w, state);
      expect($w('#reviewsStars').text).toBe('★★★★★');
    });

    it('renders all empty stars for zero rating', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue(mockZeroAggregate);
      await initProductReviews($w, state);
      expect($w('#reviewsStars').text).toBe('☆☆☆☆☆');
    });

    it('sets star color from styleReviewStars', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsStars').style.color).toBe('#E8845C');
    });
  });

  // ── Rating bars (#ratingBar1-5, #ratingCount1-5) ──────────────────

  describe('rating breakdown bars', () => {
    it('sets progress bar value for each star level', async () => {
      await initProductReviews($w, state);
      // breakdown: { 5: 6, 4: 3, 3: 2, 2: 1, 1: 0 }, total: 12
      expect($w('#ratingBar5').value).toBe(50);  // 6/12 = 50%
      expect($w('#ratingBar4').value).toBe(25);  // 3/12 = 25%
      expect($w('#ratingBar3').value).toBe(17);  // 2/12 ≈ 17%
      expect($w('#ratingBar2').value).toBe(8);   // 1/12 ≈ 8%
      expect($w('#ratingBar1').value).toBe(0);   // 0/12 = 0%
    });

    it('sets count text for each star level', async () => {
      await initProductReviews($w, state);
      expect($w('#ratingCount5').text).toBe('6');
      expect($w('#ratingCount4').text).toBe('3');
      expect($w('#ratingCount3').text).toBe('2');
      expect($w('#ratingCount2').text).toBe('1');
      expect($w('#ratingCount1').text).toBe('0');
    });

    it('sets all bars to 0 when no reviews', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getAggregateRating.mockResolvedValue(mockZeroAggregate);
      await initProductReviews($w, state);
      for (let star = 1; star <= 5; star++) {
        expect($w(`#ratingBar${star}`).value).toBe(0);
        expect($w(`#ratingCount${star}`).text).toBe('0');
      }
    });
  });

  // ── Reviews repeater (#reviewsRepeater) ────────────────────────────

  describe('reviews repeater', () => {
    it('sets up onItemReady handler', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsRepeater').onItemReady).toHaveBeenCalled();
    });

    it('populates repeater data with reviews', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsRepeater').data).toHaveLength(2);
      expect($w('#reviewsRepeater').data[0]._id).toBe('rev-1');
    });

    it('generates _id for reviews without one', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue({
        reviews: [{ authorName: 'Anon', rating: 3, body: 'OK', photos: [], verifiedPurchase: false, helpful: 0, date: 'Jan 1' }],
        total: 1, page: 0, pageSize: 10,
      });
      await initProductReviews($w, state);
      expect($w('#reviewsRepeater').data[0]._id).toBe('rev-0');
    });
  });

  // ── Review item fields ─────────────────────────────────────────────

  describe('review item rendering', () => {
    it('renders #reviewAuthor text', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewAuthor').text).toBe('Sarah M.');
      expect(items[1]('#reviewAuthor').text).toBe('Tom B.');
    });

    it('renders #reviewDate text', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewDate').text).toBe('January 15, 2026');
    });

    it('renders #reviewTitle text', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewTitle').text).toBe('Great');
    });

    it('renders empty string for missing title', async () => {
      await initProductReviews($w, state);
      const noTitleReview = { ...mockReviews.reviews[0], title: undefined };
      const items = fireOnItemReady($w, '#reviewsRepeater', [noTitleReview]);
      expect(items[0]('#reviewTitle').text).toBe('');
    });

    it('renders #reviewBody text', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewBody').text).toBe('Solid build.');
    });

    it('renders #reviewStars with star characters', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      // rev-1 has rating 5 → ★★★★★
      expect(items[0]('#reviewStars').text).toMatch(/★/);
    });

    it('shows #reviewVerified badge for verified purchases', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewVerified').show).toHaveBeenCalled();
    });

    it('hides #reviewVerified badge for non-verified purchases', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[1]('#reviewVerified').hide).toHaveBeenCalled();
    });

    it('sets ARIA label on #reviewVerified badge', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewVerified').accessibility.ariaLabel).toBe('Verified purchase');
    });

    it('renders #reviewHelpfulCount with count', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewHelpfulCount').text).toBe('Helpful (3)');
    });

    it('renders #reviewHelpfulCount without count when zero', async () => {
      await initProductReviews($w, state);
      const zeroHelpful = { ...mockReviews.reviews[0], helpful: 0 };
      const items = fireOnItemReady($w, '#reviewsRepeater', [zeroHelpful]);
      expect(items[0]('#reviewHelpfulCount').text).toBe('Helpful');
    });

    it('shows #reviewPhotos when photos exist', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[1]('#reviewPhotos').show).toHaveBeenCalled();
    });

    it('hides #reviewPhotos when no photos', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[0]('#reviewPhotos').hide).toHaveBeenCalled();
    });

    it('sets gallery items for #reviewPhotos', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews);
      expect(items[1]('#reviewPhotos').items).toEqual([{ src: 'photo.jpg', alt: 'Review photo' }]);
    });
  });

  // ── Empty state (#reviewsEmptyState) ───────────────────────────────

  describe('empty state', () => {
    beforeEach(async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockEmptyReviews);
    });

    it('shows #reviewsEmptyState when no reviews', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsEmptyState').show).toHaveBeenCalled();
    });

    it('collapses repeater when no reviews', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsRepeater').collapse).toHaveBeenCalled();
    });
  });

  describe('non-empty state', () => {
    it('hides #reviewsEmptyState when reviews exist', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsEmptyState').hide).toHaveBeenCalled();
    });

    it('expands repeater when reviews exist', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsRepeater').expand).toHaveBeenCalled();
    });
  });

  // ── Sort dropdown (#reviewsSortDropdown) ───────────────────────────

  describe('sort dropdown', () => {
    it('sets up 4 sort options', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').options).toHaveLength(4);
    });

    it('sets correct sort option values', async () => {
      await initProductReviews($w, state);
      const values = $w('#reviewsSortDropdown').options.map(o => o.value);
      expect(values).toEqual(['newest', 'highest', 'lowest', 'helpful']);
    });

    it('defaults sort to newest', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').value).toBe('newest');
    });

    it('sets ARIA label on sort dropdown', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').accessibility.ariaLabel).toBe('Sort reviews');
    });

    it('registers onChange handler', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsSortDropdown').onChange).toHaveBeenCalled();
    });

    it('re-fetches reviews on sort change', async () => {
      const backend = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      const dropdown = $w('#reviewsSortDropdown');
      dropdown.value = 'highest';
      const onChangeHandler = dropdown.onChange.mock.calls[0][0];
      await onChangeHandler();

      expect(backend.getProductReviews).toHaveBeenCalledWith(
        state.product._id,
        expect.objectContaining({ sort: 'highest', page: 0 })
      );
    });

    it('resets page to 0 on sort change', async () => {
      await initProductReviews($w, state);
      state.reviewPage = 3;
      const dropdown = $w('#reviewsSortDropdown');
      dropdown.value = 'lowest';
      const handler = dropdown.onChange.mock.calls[0][0];
      await handler();
      expect(state.reviewPage).toBe(0);
    });
  });

  // ── Pagination (#reviewsPrevBtn, #reviewsNextBtn, #reviewsPageInfo) ─

  describe('pagination', () => {
    it('sets up next button click handler', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').onClick).toHaveBeenCalled();
    });

    it('sets up prev button click handler', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsPrevBtn').onClick).toHaveBeenCalled();
    });

    it('disables prev button on first page', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsPrevBtn').disable).toHaveBeenCalled();
    });

    it('enables next button when more pages exist', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').enable).toHaveBeenCalled();
    });

    it('disables next button on last page', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').disable).toHaveBeenCalled();
    });

    it('renders page info text', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      await initProductReviews($w, state);
      expect($w('#reviewsPageInfo').text).toBe('Page 1 of 3');
    });

    it('renders empty page info when no reviews', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockEmptyReviews);
      await initProductReviews($w, state);
      expect($w('#reviewsPageInfo').text).toBe('');
    });

    it('sets ARIA labels on pagination buttons', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewsNextBtn').accessibility.ariaLabel).toBe('Next page of reviews');
      expect($w('#reviewsPrevBtn').accessibility.ariaLabel).toBe('Previous page of reviews');
    });

    it('increments page on next click', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      await initProductReviews($w, state);
      const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
      await nextHandler();
      expect(state.reviewPage).toBe(1);
      expect(backend.getProductReviews).toHaveBeenCalledWith(
        state.product._id,
        expect.objectContaining({ page: 1 })
      );
    });

    it('decrements page on prev click', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      await initProductReviews($w, state);
      state.reviewPage = 2;
      const prevHandler = $w('#reviewsPrevBtn').onClick.mock.calls[0][0];
      await prevHandler();
      expect(state.reviewPage).toBe(1);
    });

    it('clamps prev page to 0 minimum', async () => {
      await initProductReviews($w, state);
      state.reviewPage = 0;
      const prevHandler = $w('#reviewsPrevBtn').onClick.mock.calls[0][0];
      await prevHandler();
      expect(state.reviewPage).toBe(0);
    });
  });

  // ── Review form (#reviewForm, #reviewRatingInput, #reviewTitleInput,
  //    #reviewBodyInput, #reviewSubmitBtn, #reviewFormError, #reviewFormSuccess) ──

  describe('review submission form', () => {
    it('sets up submit button click handler', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewSubmitBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on submit button', async () => {
      await initProductReviews($w, state);
      expect($w('#reviewSubmitBtn').accessibility.ariaLabel).toBe('Submit your review');
    });

    it('shows error for missing rating', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '';
      $w('#reviewBodyInput').value = 'This is a valid review body text.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
      expect($w('#reviewFormError').show).toHaveBeenCalled();
    });

    it('shows error for rating below 1', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '0';
      $w('#reviewBodyInput').value = 'This is a valid review body text.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
    });

    it('shows error for rating above 5', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '6';
      $w('#reviewBodyInput').value = 'This is a valid review body text.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Please select a star rating.');
    });

    it('shows error for body shorter than 10 chars', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '5';
      $w('#reviewBodyInput').value = 'Short';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Review must be at least 10 characters.');
    });

    it('disables submit button during submission', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '5';
      $w('#reviewTitleInput').value = 'Great product';
      $w('#reviewBodyInput').value = 'This futon is amazing and comfortable.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewSubmitBtn').disable).toHaveBeenCalled();
    });

    it('shows success message on successful submission', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '5';
      $w('#reviewTitleInput').value = 'Great product';
      $w('#reviewBodyInput').value = 'This futon is amazing and comfortable.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormSuccess').show).toHaveBeenCalled();
    });

    it('collapses form on successful submission', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '5';
      $w('#reviewTitleInput').value = 'Great product';
      $w('#reviewBodyInput').value = 'This futon is amazing and comfortable.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewForm').collapse).toHaveBeenCalled();
    });

    it('shows error message on submission failure', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.submitReview.mockResolvedValue({ success: false, error: 'Already reviewed.' });
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'This is a nice product, would buy again.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Already reviewed.');
      expect($w('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('shows generic error on backend exception', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.submitReview.mockRejectedValue(new Error('Network error'));
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '4';
      $w('#reviewBodyInput').value = 'This is a nice product, would buy again.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').text).toBe('Something went wrong. Please try again.');
      expect($w('#reviewSubmitBtn').enable).toHaveBeenCalled();
    });

    it('hides #reviewFormError before valid submission attempt', async () => {
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '5';
      $w('#reviewBodyInput').value = 'This futon is amazing and comfortable.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect($w('#reviewFormError').hide).toHaveBeenCalled();
    });

    it('passes correct data to submitReview backend', async () => {
      const backend = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      $w('#reviewRatingInput').value = '4';
      $w('#reviewTitleInput').value = 'Nice';
      $w('#reviewBodyInput').value = 'Really comfortable futon frame.';
      const submitHandler = $w('#reviewSubmitBtn').onClick.mock.calls[0][0];
      await submitHandler();
      expect(backend.submitReview).toHaveBeenCalledWith(expect.objectContaining({
        productId: state.product._id,
        rating: 4,
        title: 'Nice',
        body: 'Really comfortable futon frame.',
      }));
    });
  });

  // ── Helpful voting (#reviewHelpfulBtn) ─────────────────────────────

  describe('helpful voting', () => {
    it('sets up click handler on #reviewHelpfulBtn via repeater', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews, 1);
      expect(items[0]('#reviewHelpfulBtn').onClick).toHaveBeenCalled();
    });

    it('sets ARIA label on #reviewHelpfulBtn', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews, 1);
      expect(items[0]('#reviewHelpfulBtn').accessibility.ariaLabel).toMatch(/Mark review by Sarah M. as helpful/);
    });

    it('disables button after click', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews, 1);
      const clickHandler = items[0]('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(items[0]('#reviewHelpfulBtn').disable).toHaveBeenCalled();
    });

    it('updates helpful count after successful vote', async () => {
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews, 1);
      const clickHandler = items[0]('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(items[0]('#reviewHelpfulCount').text).toBe('Helpful (4)');
    });

    it('re-enables button on markHelpful failure', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.markHelpful.mockRejectedValue(new Error('Network error'));
      await initProductReviews($w, state);
      const items = fireOnItemReady($w, '#reviewsRepeater', mockReviews.reviews, 1);
      const clickHandler = items[0]('#reviewHelpfulBtn').onClick.mock.calls[0][0];
      await clickHandler();
      expect(items[0]('#reviewHelpfulBtn').enable).toHaveBeenCalled();
    });
  });

  // ── SPA state-bleed regression ─────────────────────────────────────

  describe('SPA navigation state reset', () => {
    it('resets sort to newest on each init', async () => {
      const backend = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      // Simulate sort change
      const dropdown = $w('#reviewsSortDropdown');
      dropdown.value = 'helpful';
      const onChange = dropdown.onChange.mock.calls[0][0];
      await onChange();

      // Navigate to second product (SPA)
      vi.clearAllMocks();
      backend.getAggregateRating.mockResolvedValue(mockAggregate);
      backend.getProductReviews.mockResolvedValue(mockReviews);
      const $w2 = create$w();
      const state2 = { product: { ...futonFrame, _id: 'product-2' } };

      await initProductReviews($w2, state2);
      expect($w2('#reviewsSortDropdown').value).toBe('newest');
      expect(backend.getProductReviews).toHaveBeenCalledWith(
        'product-2',
        expect.objectContaining({ sort: 'newest', page: 0 })
      );
    });

    it('resets page to 0 on each init', async () => {
      const backend = await import('backend/reviewsService.web');
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      await initProductReviews($w, state);
      // Go to page 1
      const nextHandler = $w('#reviewsNextBtn').onClick.mock.calls[0][0];
      await nextHandler();

      // Navigate to second product
      vi.clearAllMocks();
      backend.getAggregateRating.mockResolvedValue(mockAggregate);
      backend.getProductReviews.mockResolvedValue(mockMultiPageReviews);
      const $w2 = create$w();
      const state2 = { product: { ...futonFrame, _id: 'product-2' } };

      await initProductReviews($w2, state2);
      expect(backend.getProductReviews).toHaveBeenCalledWith(
        'product-2',
        expect.objectContaining({ page: 0 })
      );
      expect($w2('#reviewsPrevBtn').disable).toHaveBeenCalled();
    });
  });

  // ── Missing element resilience ─────────────────────────────────────

  describe('missing element handling', () => {
    it('handles missing #reviewsRepeater gracefully', async () => {
      const $w = create$w(['#reviewsRepeater']);
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });

    it('handles missing #reviewsSortDropdown gracefully', async () => {
      const $w = create$w(['#reviewsSortDropdown']);
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });

    it('handles missing #reviewSubmitBtn gracefully', async () => {
      const $w = create$w(['#reviewSubmitBtn']);
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });

    it('handles missing #reviewsNextBtn gracefully', async () => {
      const $w = create$w(['#reviewsNextBtn']);
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });

    it('handles missing #reviewsPrevBtn gracefully', async () => {
      const $w = create$w(['#reviewsPrevBtn']);
      await expect(initProductReviews($w, state)).resolves.not.toThrow();
    });
  });

  // ── Backend call verification ──────────────────────────────────────

  describe('backend calls', () => {
    it('fetches aggregate and reviews in parallel', async () => {
      const backend = await import('backend/reviewsService.web');
      await initProductReviews($w, state);
      expect(backend.getAggregateRating).toHaveBeenCalledWith(state.product._id);
      expect(backend.getProductReviews).toHaveBeenCalledWith(state.product._id, { sort: 'newest', page: 0 });
    });

    it('does not fetch when product ID is falsy', async () => {
      const backend = await import('backend/reviewsService.web');
      state.product._id = '';
      await initProductReviews($w, state);
      expect(backend.getAggregateRating).not.toHaveBeenCalled();
    });
  });
});
